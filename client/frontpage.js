Router.route('/', function () {
    Meteor.subscribe("topChannels");
    this.render('frontpage');
});

Template.frontpage.helpers({
    topChannels: function () {
        return Channels.find();
    }
});

Template.frontpage.events({
    'click .top-channel-link': function (e) {
        Router.stop();
        e.preventDefault();
        window.location.href = e.currentTarget.href;
    },
    'click .create-channel-button': function (e) {
        window.location.href = "/c/" + $(".create-channel-input").val();
    },
    'keyup .create-channel-input': function (e) {
        if (e.which == 13) {
            // Enter pressed
            window.location.href = "/c/" + $(".create-channel-input").val();
        }
    }
});