Titles = new Meteor.Collection('titles');

if (Meteor.isServer && Titles.find().count() == 0) {
    var titles = [
        {
            name: 'Catgroove',
            ytid: 'twqM56f_cVo'
        },
        {
            name: 'Mix 2013',
            ytid: 'z0zs7zmOEPQ'
        },
        {
            name: 'The princess',
            ytid: 'fcOlPiMwcdc'
        }
    ];
    _.each(titles, function (title) {
        Titles.insert(title);
    });
}

Configs = new Meteor.Collection("configs");
if (Meteor.isServer && Configs.find().count() == 0) {
    var configs = [
        {
            config_name: 'active-title',
            config_value: Titles.findOne()._id
        }
    ];
    _.each(configs, function (config) {
        Configs.insert(config);
    });
}
Meteor.methods({
    updateplaying: function (id) {
        Configs.update({config_name: "active-title"}, {config_name:"active-title",config_value: id});
    },
    getCurrentPlaying: function() {
        return Configs.findOne({config_name:"active-title"}).config_value;
    }
});