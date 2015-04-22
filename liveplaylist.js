Videos = new Mongo.Collection("videos");
Channels = new Mongo.Collection("channels");
player = null;
skipStateChange = false;
videoPage = new ReactiveDict;
videoPage.set("channelSlug","sopamo");
videoPage.set("currentVideo","");

if (Meteor.isClient) {
    onYouTubeIframeAPIReady = function () {
        Meteor.call("getChannel",videoPage.get("channelSlug"), function(error, channel) {
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
                        // We have to skip the state change when it was not user initiated but coming from the player switching state because we - and not the user - told it to.
                        // Otherwise the state change would issue another Meteor.call which would again lead to a state change, and so on...
                        if(skipStateChange && event.data >= 0) {
                            skipStateChange = false;
                            return;
                        }
                        switch (event.data) {
                            case 0: // Ended
                                // Start next video
                                //var currentTime = event.target.getCurrentTime();
                                //Meteor.call("setVideoStatus", videoPage.get("channelSlug"), event.data, 0);
                                break;
                            case 1: // Now playing
                                // Propagate start
                                var currentTime = event.target.getCurrentTime();
                                Meteor.call("setVideoStatus", videoPage.get("channelSlug"),event.data,currentTime);
                                break;
                            case 2: // Paused
                                // Propagate stop
                                var currentTime = event.target.getCurrentTime();
                                Meteor.call("setVideoStatus", videoPage.get("channelSlug"), event.data, currentTime);
                                break;
                        }
                    }
                }
            });
        });
    };
    
    YT.load();
    Template.videolist.helpers({
        videos: function () {
            return Videos.find({
                channel: videoPage.get("channelSlug")
            }).fetch();
        }
    });
    Template.video.helpers({
        isActive: function(ytid) {
            var channel = Channels.findOne({
                "slug": videoPage.get("channelSlug")
            });
            if(!channel) {
                return false;
            }
            return ytid == channel.active;
        }
    });

    Template.videolist.events({
        "submit .add-video": function (event) {
            // This function is called when the new video form is submitted

            var url = event.target.text.value;

            var params = getQueryParams(url);
            $.ajax({url: "https://gdata.youtube.com/feeds/api/videos/" + params.v + "?v=2&alt=json"}).done(function (data) {
                Videos.insert({
                    title: data.entry.title.$t,
                    ytid: params.v,
                    channel: videoPage.get("channelSlug")
                });
            });

            // Clear form
            event.target.text.value = "";

            // Prevent default form submit
            return false;
        },
        "submit .channel-select": function(event) {
            // This function is called when a new channel is selected
            Router.go("/c/" +  $(".channel-input").val());
            
            return false;
        }
    });

    Template.video.events({
        'click .video-entry': function (event, template) {
            Meteor.call('changeVideo', videoPage.get("channelSlug"), $(event.target).data("videoid"), function (error, result) {
                if (error) {
                    alert("Couldn't change video :(");
                }
            });
        }
    });

    Tracker.autorun(function() {
        var c = Channels.findOne({
            "slug": videoPage.get("channelSlug")
        });

        if (player != null) {
            if(currentVideo != c.active) {
                // Play the active video if it is not the one already playing
                currentVideo = c.active;
                skipStateChange = true;
                player.loadVideoById(c.active, 0);
            } else {
                // Check which state we have
                if(c.status == 1) {
                    // We are now playing the video but it is the same video like before. Go to the given position in the video.
                    // TODO: Implement lag compensation with currentTimeUpdated
                    skipStateChange = true;
                    player.seekTo(c.currentTime,true);
                    skipStateChange = true;
                    player.playVideo();
                } else if(c.status == 2) {
                    skipStateChange = true;
                    player.pauseVideo();
                }
            }
            
        }
    });

    Router.route('/', function () {
        videoPage.set("channelSlug","sopamo");
        this.render('videolist');
    });
    
    Router.route('/c/:_channelSlug', function () {
        videoPage.set("channelSlug", this.params._channelSlug);
        this.render('videolist');
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
            Videos.insert({
                title: "You are a Pirate Limewire 10 hours", 
                ytid: "IBH4g_ua5es",
                channel: "sopamo"
            });
            Videos.insert({
                title: "01. My Dear Frodo- The Hobbit: An Unexpected Journey- Soundtrack", 
                ytid: "_gwLxntIfZY",
                channel: "sopamo"
            });
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

            var channel = Channels.findOne({
                "slug": channelSlug
            });
            if(!channel) {
                channel = Channels.insert({
                    slug: channelSlug,
                    active: "",
                    currentStatus: -1,
                    currentTime: 0,
                    currentTimeUpdated: 0
                });
            }
            return channel;
        }
    });
}
