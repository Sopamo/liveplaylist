Template.playlist.helpers({
    titles: Titles.find()
});

Template.nowplaying.helpers({
    title: function() {
        return Titles.findOne();
    }
});
Meteor.Router.add({
    '/': 'nowplaying',
    '/p/:id': function(id) {
        Template.nowplaying.helpers({
            title: Titles.findOne({ytid:id})
        });
        return 'nowplaying';
    }
});