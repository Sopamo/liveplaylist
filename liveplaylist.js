Videos = new Mongo.Collection("videos");
Channels = new Mongo.Collection("channels");

if (Meteor.isClient) {
    // This code only runs on the client
    Template.body.helpers({
        videos: function () {
            return Videos.find({});
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

    Channels.findOne({
        "slug": "sopamo" // TODO: Use the current channel here
    }).observeChanges({
        added: function () {
        },
        changed: function (id, fields) {
            console.log(fields);
        },
        removed: function () {
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
}
