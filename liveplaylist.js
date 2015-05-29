Videos = new Mongo.Collection("videos");
Channels = new Mongo.Collection("channels");
player = null;
videoPage = new ReactiveDict;
videoPage.set("channelSlug","sopamo");
videoPage.set("currentVideo","");

if (Meteor.isClient) {

    Tracker.autorun(function() {
        Meteor.subscribe("channelVideos", videoPage.get("channelSlug"));
        Meteor.subscribe("channel", videoPage.get("channelSlug"));    
    });
    
    Meteor.subscribe("topChannels");
    
    
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
                
                playerVars: {
                    disablekb: 1,
                    controls: 0,
                    playsinline: 1,
                    rel: 0,
                    showinfo: 0
                },

                videoId: channel.active,

                // Events like ready, state change, 
                events: {
                    onReady: function (event) {
                        // Play video when player ready.
                        // event.target.playVideo();

                        // YouTube is ready, setup the channel listener
                        Tracker.autorun(function () {
                            var c = Channels.findOne({
                                "slug": videoPage.get("channelSlug")
                            });

                            if (player != null && player.loadVideoById && c) {
                                if (currentVideo != c.active) {
                                    // Play the active video if it is not the one already playing
                                    currentVideo = c.active;
                                    player.loadVideoById(c.active, 0);
                                }
                                // Check which state we have
                                if (c.status == 1) {
                                    // We are now playing the video but it is the same video like before. Go to the given position in the video.
                                    // TODO: Implement lag compensation with currentTimeUpdated
                                    player.seekTo(c.currentTime, true);
                                    player.playVideo();
                                    $(".play-toggle").attr("src", "/img/ic_pause_black_24dp.png").removeClass("rotate");
                                } else if (c.status == 2) {
                                    player.seekTo(c.currentTime, true);
                                    player.pauseVideo();
                                    $(".play-toggle").attr("src", "/img/ic_play_arrow_black_24dp.png").removeClass("rotate");
                                }
                            }
                        });


                        // Setup the progress bar dragging
                        var progress = $(".player-progress").get(0);
                        var dragActive = false;
                        
                        // Also setup the progress bar update
                        window.setInterval(function() {
                            // Only update the progress bar when we are not currently dragging it and if the player is playing
                            if(!dragActive && player.getPlayerState() == 1) {
                                var percentage = player.getCurrentTime() / player.getDuration();
                                $(".player-progress").attr("value",percentage * 100);
                            }
                        },1000);
                        
                        // Handle the drag events for the progress bar
                        progress.addEventListener("mousedown", function () {
                            dragActive = true;
                        }, false);
                        progress.addEventListener("mousemove", function (e) {
                            if(dragActive) {
                                var percentage = e.layerX / e.target.clientWidth;
                                $(".player-progress").attr("value", percentage * 100);
                            }
                        }, false);
                        progress.addEventListener("mouseup", function (e) {
                            dragActive = false;
                            var percentage = e.layerX / e.target.clientWidth;
                            $(".player-progress").attr("value", percentage * 100);
                            $(".play-toggle").attr("src", "/img/ic_sync_black_24dp.png").addClass("rotate");
                            Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 1, percentage * player.getDuration());
                        }, false);
                    },
                    onStateChange: function(event) {
                        switch (event.data) {
                            case 0: // Ended
                                // Start next video
                                //Meteor.call("setVideoStatus", videoPage.get("channelSlug"), event.data, 0);
                                break;
                            case 1: // Now playing
                                break;
                            case 2: // Paused
                                break;
                        }
                    }
                }
            });
        });
    };
    
    YT.load();

    AccountsTemplates.addField({
        _id: 'username',
        type: 'text',
        required: true,
        func: function (value) {
            if (Meteor.isClient) {
                console.log("Validating username...");
                var self = this;
                Meteor.call("userExists", value, function (err, userExists) {
                    if (!userExists)
                        self.setSuccess();
                    else
                        self.setError(userExists);
                    self.setValidating(false);
                });
                return;
            }
            // Server
            return Meteor.call("userExists", value);
        }
    });
    
    Template.videolist.helpers({
        videos: function () {
            return Videos.find({
                channel: videoPage.get("channelSlug")
            }).fetch();
        },
        channelSlug: function() {
            return videoPage.get("channelSlug");
        },
        topChannels: function () {
            return Channels.find();
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
        // 'change' is the event emitted by the component
        'change #video-menu': function (e, template) {
            console.log(e.target.value);
        },
        "submit .add-video": function (event) {
            // This function is called when the new video form is submitted
            
            var url = event.target.text.value;

            var params = getQueryParams(url);
            
            Meteor.call('addVideo', videoPage.get("channelSlug"), params.v, function (error, result) {
                if (error) {
                    alert("Couldn't add the video :(");
                }
            });

            // Clear form
            event.target.text.value = "";

            // Prevent default form submit
            return false;
        },
        "click .add-video" : function(e) {
            console.log("click");
        },
        "click .play-toggle": function (e) {
            var currentTime = player.getCurrentTime();
            $(".play-toggle").attr("src", "/img/ic_sync_black_24dp.png").addClass("rotate");
            if(player.getPlayerState() != 1) {
                // Not playing, start the video
                Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 1, currentTime);
            } else {
                // Playing, now pause
                Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 2, currentTime);
            }
        },
        "click .open-navigation": function (e) {
            console.log("foo");
        },
        "submit .channel-select": function(event) {
            // This function is called when a new channel is selected
            Router.go("/c/" +  $(".channel-input").val());
            
            return false;
        }
    });

    Template.video.events({
        'click .video-entry': function (event, template) {
            $(".play-toggle").attr("src", "/img/ic_sync_black_24dp.png").addClass("rotate");
            Meteor.call('changeVideo', videoPage.get("channelSlug"), $(event.target).data("videoid"), function (error, result) {
                if (error) {
                    console.log(error);
                    alert("Couldn't change video :(");
                }
                Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 1, 0);
            });
        }
    });

    Router.route('/', function () {
        videoPage.set("channelSlug","sopamo");
        this.render('videolist');
    });
    
    Router.route('/c/:_channelSlug', function () {
        videoPage.set("channelSlug", this.params._channelSlug);
        Meteor.subscribe("channel", videoPage.get("channelSlug"));
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
                title: "Sopamo",
                slug: "sopamo",
                active:"IBH4g_ua5es",
                currentStatus:1,
                currentTime:0,
                currentTimeUpdated: 1429615671
            });
        }
    });

    YoutubeApi.authenticate({
        type: 'key',
        key: 'AIzaSyDyrnr-qmqnPrBZwmnMnNnz7uSMSY_XJmM'
    });
    
    Meteor.publish('topChannels', function() {
        return Channels.find({});
    });

    Meteor.publish('channel', function (channelSlug) {
        return Channels.find({
            slug: channelSlug
        });
    });
    
    Meteor.publish('channelVideos', function(channelSlug) {
        return Videos.find({
            channel: channelSlug
        });
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
        },
        addVideo: function(channelSlug, videoId) {
            
            YoutubeApi.videos.list({
                part: "contentDetails,snippet",
                id: videoId
            }, Meteor.bindEnvironment(function (err, data) {
                if (!err) {
                    console.log(data.items[0]);
                    var duration = data.items[0].contentDetails.duration;
                    Videos.insert({
                        title: data.items[0].snippet.title,
                        ytid: videoId,
                        channel: channelSlug,
                        duration: duration
                    });
                } else {
                    console.log(err);
                }
            }, function () {
                console.log('Failed to bind environment');
            }));
            return true;
        }
    });
}
