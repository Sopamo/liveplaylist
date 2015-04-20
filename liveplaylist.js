Videos = new Mongo.Collection("videos");
Channels = new Mongo.Collection("channels");
var player = null;
var channelSlug = "sopamo"; // TODO: Use the current channel here

if (Meteor.isClient) {
    onYouTubeIframeAPIReady = function () {

        var channel = Channels.findOne({
            "slug": channelSlug
        });
        
        // New Video Player, the first argument is the id of the div.
        // Make sure it's a global variable.
        player = new YT.Player("player", {
            height: "400",
            width: "600",

            videoId: channel.active,

            // Events like ready, state change, 
            events: {
                onReady: function (event) {
                    // Play video when player ready.
                    event.target.playVideo();
                }
            }
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
            return ytid == channel.active;
        }
    });

    Template.body.events({
        "submit .add-video": function (event) {
            // This function is called when the new video form is submitted

            var url = event.target.text.value;

            var params = getQueryParams(url);
            console.log(params);
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
                    alert("Couln't change video :(");
                }
            });
        }
    });

    Tracker.autorun(function() {
        var c = Channels.findOne({
            "slug": "sopamo" // TODO: Use the current channel here
        });
        console.log("rerun");

        if (player != null) {
            player.loadVideoById(c.active, 0);
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
        // code to run on server at startup
    });

    Videos.allow({
        insert: function (userId, video) {
            return true
        }
        // since there is no update nor a remove field, all updates
        // are automatically denied
    });

    Meteor.methods({
        changeVideo: function (channel, videoId) {
            // Check argument types
            check(channel, String);
            check(videoId, String);

            Channels.update(
                    {
                        slug: channel
                    }, {
                        $set: {
                            active: videoId
                        }
                    });

            return true;
        }
    });
}
