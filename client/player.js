ytPlayer = null;
videoPage = new ReactiveDict;
videoPage.set("channelSlug", "sopamo");
videoPage.set("currentVideo", "");
videoPage.set("youtubeResults", []);
videoPage.set("channelMembers", []);
currentChannel = null;
onYouTubeIframeAPIReady = null;

Router.route('/c/:_channelSlug', function () {
    videoPage.set("channelSlug", this.params._channelSlug);
    Meteor.subscribe("topChannels");
    Tracker.autorun(function () {
        Meteor.subscribe("channelVideos", videoPage.get("channelSlug"));
        Meteor.subscribe("channel", videoPage.get("channelSlug"));
        Meteor.subscribe("channelRights", videoPage.get("channelSlug"));
        updateMemberList();
    });

    updateRights();

    initalizeYoutube();


    this.render('videolist');
});

function updateRights() {
    Meteor.call("getRights",videoPage.get("channelSlug"), function(err,rights) {
        if(hasRight(rights,"changeActiveVideo")) {
            $(".play-toggle").show();
            $(".progress").get(0).style.pointerEvents = "auto";
            $(".video-list").removeClass("nopointer");
        } else {
            $(".play-toggle").hide();
            $(".progress").get(0).style.pointerEvents = "none";
            $(".video-list").addClass("nopointer");
        }

        if (hasRight(rights, "addVideo")) {
            $(".add-video-wrapper").show();
        } else {
            $(".add-video-wrapper").hide();
        }

        if (hasRight(rights, "addMessage")) {
            $(".chat-form").show();
        } else {
            $(".chat-form").hide();
        }

    });

    function hasRight(rights,right) {
        var result = true;
        $.each(rights,function(k,r) {
            if(r.right == right) {
                result = r.value;
            }
        });
        console.log("RIGHT: " + right + ": " + result);
        return result;
    }
}

AccountsTemplates.addField({
    _id: 'username',
    type: 'text',
    required: true,
    func: function (value) {
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
});

Template.videolist.helpers({
    videos: function () {
        return Videos.find({
            channel: videoPage.get("channelSlug")
        }).fetch();
    },
    channelSlug: function () {
        return videoPage.get("channelSlug");
    },
    currentChannel: function () {
        var c = Channels.findOne({
            "slug": videoPage.get("channelSlug")
        });
        return c;
    },
    topChannels: function () {
        return Channels.find();
    },
    username: function () {
        return Meteor.user().username || Meteor.user().profile.name;
    },
    multiple: function(val) {
        return val > 1;
    },
    youtubeResults: function() {
        return videoPage.get("youtubeResults");
    },
    rights: function() {
        var rights = Rights.find({
            channelSlug: videoPage.get("channelSlug")
        }).fetch();
        var data = {};
        $.each(rights,function(k,right) {
            if(typeof data[right.level] == "undefined") {
                data[right.level] = {};
            }
            data[right.level][right.right] = right.value;
        });
        return data;
    },
    isChecked: function (rights,level,right) {
        if(typeof rights[level] == "undefined") {
            return false;
        }
        return rights[level][right];
    },
    members: function() {
        return videoPage.get("channelMembers");
    }
});
Template.video.helpers({
    isActive: function (ytid) {
        var channel = Channels.findOne({
            "slug": videoPage.get("channelSlug")
        });
        if (!channel) {
            return false;
        }
        return ytid == channel.active;
    }
});

Template.videolist.rendered = function() {
    $('.search-trigger').leanModal();
    return;
    $('#add-video-content').autocomplete({
        lookup: function (query, done) {
            // Do ajax call or lookup locally, when done,
            // call the callback and pass your results:
            var result = {
                suggestions: []
            };

            $.getJSON("http://suggestqueries.google.com/complete/search?callback=?",
                    {
                        "hl": "en", // Language
                        "ds": "yt", // Restrict lookup to youtube
                        "jsonp": "suggestCallBack", // jsonp callback function name
                        "q": query, // query term
                        "client": "youtube" // force youtube style response, i.e. jsonp
                    }
            );
            suggestCallBack = function (data) {
                $.each(data[1], function (key, val) {
                    result.suggestions.push({"value": val[0]});
                });
                result.suggestions.length = 5; // prune suggestions list to only 5 items
                done(result);
            };

        },
        onSelect: function (suggestion) {
            $(".add-video").submit();
        }
    });
};

Template.videolist.events({
    "submit .add-video": function (event) {
        // This function is called when the new video form is submitted
        var query = $("#add-video-content").val();
        var $resultsContainer = $("#youtube-results");
        $.getJSON("https://www.googleapis.com/youtube/v3/search?videoEmbeddable=true&part=snippet&q=" + encodeURIComponent(query) + "&type=video&maxResults=5&key=AIzaSyDyrnr-qmqnPrBZwmnMnNnz7uSMSY_XJmM").done(function(data) {
            console.log(data);
            var videos = [];
            $.each(data.items,function(key,video) {
                videos.push({
                    ytid: video.id.videoId,
                    image: video.snippet.thumbnails.medium.url,
                    title: video.snippet.title
                });
            });
            videoPage.set("youtubeResults",videos);
        }).error(function() {
            alert("An error occured :( Please reload the page and try again.");
        });

        /**/

        // Prevent default form submit
        return false;
    },
    "click .youtube-result": function(event) {

        Meteor.call('addVideo', videoPage.get("channelSlug"), $(event.target).data("ytid"), function (error, result) {
            if (error) {
                alert("Couldn't add the video :(");
            }
        });

        // Clear form
        $("#add-video-content").val("");
        videoPage.set("youtubeResults", []);
        // Close form
        $("#pages").get(0).selected = 0;
    },
    "click #grid": function (event) {
        $("#fullsize-card").get(0).color = "blue";
        $("#pages").get(0).selected = 1;
    },
    "click #add-video-button": function (e) {
        $(".add-video").trigger("submit");
    },
    "click .play-toggle": function (e) {
        var currentTime = ytPlayer.getCurrentTime();
        $(".play-toggle").attr("src", "/img/ic_sync_black_24dp.png").addClass("rotate");
        if (ytPlayer.getPlayerState() != 1) {
            // Not playing, start the video
            Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 1, currentTime);
        } else {
            // Playing, now pause
            Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 2, currentTime);
        }
    },
    "immediate-value-change #volume": function(e) {
        if (ytPlayer && ytPlayer.setVolume) {
            ytPlayer.setVolume($(".volume-slider").get(0).immediateValue);
        }
    }
});

Template.video.events({
    'click .video-entry': function (event, template) {
        $(".play-toggle").text("refresh").addClass("rotate");
        Meteor.call('changeVideo', videoPage.get("channelSlug"), $(event.target).data("videoid"), function (error, result) {
            if (error) {
                console.log(error);
                alert("Couldn't change video :(");
            }
            Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 1, 0);
        });
    }
});

function initalizeYoutube() {
    onYouTubeIframeAPIReady = function () {
        Meteor.call("getChannel", videoPage.get("channelSlug"), function (error, channel) {
            if (error) {
                alert("Whoops, an error occured. Try to reload the page.");
                return;
            }

            currentVideo = channel.active;

            ytPlayer = new YT.Player("player", {
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
                            currentChannel = Channels.findOne({
                                "slug": videoPage.get("channelSlug")
                            });

                            if (ytPlayer != null && ytPlayer.loadVideoById && currentChannel) {
                                if (currentVideo != currentChannel.active) {
                                    // Play the active video if it is not the one already playing
                                    currentVideo = currentChannel.active;
                                    ytPlayer.loadVideoById(currentChannel.active, 0);
                                }

                                var currentTime = currentChannel.currentTime + ((new Date().getTime() / 1000) - currentChannel.currentTimeUpdated);

                                // Check which state we have
                                if (currentChannel.currentStatus == 1) {

                                    // We are now playing the video but it is the same video like before. Go to the given position in the video.
                                    ytPlayer.seekTo(currentTime, true);
                                    ytPlayer.playVideo();
                                    $(".play-toggle").text("pause_circle_filled").removeClass("rotate");

                                } else if (currentChannel.currentStatus == 2) {

                                    // We have to stop the video
                                    ytPlayer.seekTo(currentTime, true);
                                    ytPlayer.pauseVideo();
                                    $(".play-toggle").text("play_circle_filled").removeClass("rotate");
                                }
                            }
                        });


                        // Setup the progress bar dragging
                        var progress = $(".progress").get(0);
                        var dragActive = false;

                        // Also setup the progress bar update
                        window.setInterval(function () {
                            // Only update the progress bar when we are not currently dragging it and if the player is playing
                            if (!dragActive && ytPlayer.getPlayerState() == 1) {
                                var percentage = ytPlayer.getCurrentTime() / ytPlayer.getDuration();
                                $(".progress").attr("value", percentage * 100);
                            }
                        }, 1000);

                        // Handle the drag events for the progress bar
                        progress.addEventListener("mousedown", function () {
                            dragActive = true;
                        }, false);
                        progress.addEventListener("mousemove", function (e) {
                            if (dragActive) {
                                var percentage = e.layerX / e.target.clientWidth;
                                $(".progress").attr("value", percentage * 100);
                            }
                        }, false);
                        progress.addEventListener("mouseup", function (e) {
                            dragActive = false;
                            var percentage = e.layerX / e.target.clientWidth;
                            $(".progress").attr("value", percentage * 100);
                            $(".play-toggle").attr("src", "/img/ic_sync_black_24dp.png").addClass("rotate");
                            Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 1, percentage * ytPlayer.getDuration());
                        }, false);
                    },
                    onStateChange: function (event) {
                        switch (event.data) {
                            case 0: // Ended
                                // Start next video
                                startNextVideo();
                                break;
                            case 1: // Now playing
                                if (currentChannel.currentStatus == 2) {
                                    // The user clicked the video to play the video. This event didn't occur because of a meteor sync.
                                    // Tell the server to play the video
                                    var currentTime = currentChannel.currentTime + ((new Date().getTime() / 1000) - currentChannel.currentTimeUpdated);
                                    Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 1, currentTime);
                                    $(".play-toggle").attr("src", "/img/ic_pause_black_24dp.png").removeClass("rotate");
                                }
                                break;
                            case 2: // Paused
                                if (currentChannel.currentStatus == 1) {
                                    // The user clicked the video to pause the video. This event didn't occur because of a meteor sync.
                                    // Tell the server to pause the video
                                    var currentTime = currentChannel.currentTime + ((new Date().getTime() / 1000) - currentChannel.currentTimeUpdated);
                                    Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 2, currentTime);
                                    $(".play-toggle").attr("src", "/img/ic_play_arrow_black_24dp.png").removeClass("rotate");
                                }
                                break;
                        }
                    },
                    onError: function () {
                        startNextVideo();
                    }
                }
            });
        });
    };

    var tag = document.createElement('script');

    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

function startNextVideo() {
    var $nextVideo = $(".video-entry.active").next();
    if (!$nextVideo.length) {
        $nextVideo = $(".video-entry:first");
    }
    if (!$nextVideo.length) return;
    // Already cue the next video
    ytPlayer.cueVideoById($nextVideo.data("videoid"));
    Meteor.call('changeVideo', videoPage.get("channelSlug"), $nextVideo.data("videoid"), function (error, result) {
        if (error) {
            console.log(error);
            alert("Couldn't change video :(");
        }
        Meteor.call("setVideoStatus", videoPage.get("channelSlug"), 1, 0);
    });
}

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

function updateMemberList() {
    Meteor.call("getChannelMembers", videoPage.get("channelSlug"), function (err, members) {
        videoPage.set("channelMembers", members);
    });
}
