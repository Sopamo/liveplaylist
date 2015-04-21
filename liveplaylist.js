Videos = new Mongo.Collection("videos");
Channels = new Mongo.Collection("channels");
var player = null;
var channelSlug = "sopamo"; // TODO: Use the current channel here
var currentVideo = "";

if (Meteor.isClient) {
    onYouTubeIframeAPIReady = function () {
        Meteor.call("getChannel",channelSlug, function(error, channel) {
            if(error) {
                alert("Whoops, an error occured. Try to reload the page.");
                return;
            }
            
            currentVideo = channel.active;
            
            player = new YT.Player("player", {
                height: "400",
                width: "600",

                videoId: channel.active,

                // Events like ready, state change, 
                events: {
                    onReady: function (event) {
                        // Play video when player ready.
                        event.target.playVideo();
                    },
                    onStateChange: function(event) {
                        switch (event.data) {
                            case 0: // Ended
                                // Start next video
                                //var currentTime = event.target.getCurrentTime();
                                //Meteor.call("setVideoStatus", channelSlug, event.data, 0);
                                break;
                            case 1: // Now playing
                                // Propagate start
                                var currentTime = event.target.getCurrentTime();
                                Meteor.call("setVideoStatus",channelSlug,event.data,currentTime);
                                break;
                            case 2: // Paused
                                // Propagate stop
                                var currentTime = event.target.getCurrentTime();
                                Meteor.call("setVideoStatus", channelSlug, event.data, currentTime);
                                break;
                        }
                    }
                }
            });
        });
    };
    
    YT.load();
    
    // This code only runs on the client
    Template.body.helpers({
        videos: function () {
            return Videos.find({});
        }
    });
    
    Template.video.helpers({
        isActive: function(ytid) {
            var channel = Channels.findOne({
                "slug": channelSlug
            });
            if(!channel) {
                return false;
            }
            return ytid == channel.active;
        }
    });

    Template.body.events({
        "submit .add-video": function (event) {
            // This function is called when the new video form is submitted

            var url = event.target.text.value;

            var params = getQueryParams(url);
            $.ajax({url: "https://gdata.youtube.com/feeds/api/videos/" + params.v + "?v=2&alt=json"}).done(function (data) {
                Videos.insert({
                    title: data.entry.title.$t,
                    ytid: params.v
                });
            });

            // Clear form
            event.target.text.value = "";

            // Prevent default form submit
            return false;
        }
    });

    Template.video.events({
        'click .video-entry': function (event, template) {
            Meteor.call('changeVideo', channelSlug, $(event.target).data("videoid"), function (error, result) {
                if (error) {
                    alert("Couldn't change video :(");
                }
            });
        }
    });

    Tracker.autorun(function() {
        var c = Channels.findOne({
            "slug": "sopamo" // TODO: Use the current channel here
        });

        if (player != null) {
            if(currentVideo != c.active) {
                // Play the active video if it is not the one already playing
                currentVideo = c.active;
                player.loadVideoById(c.active, 0);
            } else {
                console.log(c);
                // Check which state we have
                if(c.status == 1) {
                    // We are now playing the video but it is the same video like before. Go to the given position in the video.
                    // TODO: Implement lag compensation with currentTimeUpdated
                    player.seekTo(c.currentTime,true);
                    player.playVideo();
                } else if(c.status == 2) {
                    player.pauseVideo();
                }
            }
            
        }
    });
    

    function getQueryParams(qs) {
        qs = qs.split("?")[1];
        qs = qs.split("+").join(" ");

        var params = {}, tokens,
                re = /[?&]?([^=]+)=([^&]*)/g;

        while (tokens = re.exec(qs)) {
            params[decodeURIComponent(tokens[1])]
                    = decodeURIComponent(tokens[2]);
        }

        return params;
    }
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        if (Videos.find().count() === 0) {
            Videos.insert({title: "You are a Pirate Limewire 10 hours", ytid: "IBH4g_ua5es"});
            Videos.insert({title: "01. My Dear Frodo- The Hobbit: An Unexpected Journey- Soundtrack", ytid: "_gwLxntIfZY"});
        }
        if (Channels.find().count() === 0) {
            Channels.insert({
                slug: "sopamo",
                active:"IBH4g_ua5es",
                currentStatus:1,
                currentTime:0,
                currentTimeUpdated: 1429615671
            });
        }
    });

    Videos.allow({
        insert: function (userId, video) {
            return true
        }
        // since there is no update nor a remove field, all updates
        // are automatically denied
    });

    Meteor.methods({
        changeVideo: function (channelSlug, videoId) {
            // Check argument types
            check(channelSlug, String);
            check(videoId, String);

            Channels.update(
                    {
                        slug: channelSlug
                    }, {
                        $set: {
                            active: videoId,
                            currentTime: 0,
                            currentTimeUpdated: Math.floor(Date.now() / 1000)
                        }
                    });

            return true;
        },
        setVideoStatus: function(channelSlug, status, time) {
            // Check argument types
            check(channelSlug, String);

            Channels.update(
                    {
                        slug: channelSlug
                    }, {
                        $set: {
                            status: status,
                            currentTime: time,
                            currentTimeUpdated: Math.floor(Date.now() / 1000)
                        }
                    });

            return true;
        },
        getChannel: function(channelSlug) {
            check(channelSlug, String);

            return Channels.findOne({
                "slug": channelSlug
            });
        }
    });
}
