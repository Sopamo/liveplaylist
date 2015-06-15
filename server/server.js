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
            active: "IBH4g_ua5es",
            currentStatus: 1,
            currentTime: 0,
            currentTimeUpdated: 1429615671,
            activeUsers: 0,
            messages: [],
            members: [],
            moderators: [],
            owner: null
        });
    }
    if (Rights.find().count() === 0) {
        Rights.insert({
            channelSlug: "sopamo",
            level: "guest", // Can be guest|member|moderator
            right: "removeVideo", // Can be viewChannel|addVideo|removeVideo|changeActiveVideo|addMessage
            value: false
        });
    }
});

YoutubeApi.authenticate({
    type: 'key',
    key: 'AIzaSyDyrnr-qmqnPrBZwmnMnNnz7uSMSY_XJmM'
});

Meteor.publish('topChannels', function () {
    return Channels.find({active: {$ne: ""}});
});

Meteor.publish('channel', function (channelSlug) {

    // Increase the active user by one
    try {
        Channels.update(
                {
                    slug: channelSlug
                }, {
                    $inc: {
                        "activeUsers": 1
                    }
                });
    } catch (e) {
        Channels.update(
                {
                    slug: channelSlug
                }, {
                    $set: {
                        "activeUsers": 1
                    }
                });
    }
    this.onStop(function () {
        Channels.update(
                {
                    slug: channelSlug
                }, {
                    $inc: {
                        "activeUsers": -1
                    }
                });
    });

    var channel = Channels.find({
        slug: channelSlug
    });
    return channel;
});

Meteor.publish("channelRights", function(channelSlug) {
    return Rights.find({
        channelSlug: channelSlug
    });
});

Meteor.publish('channelVideos', function (channelSlug) {
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
    getTopChannels: function () {
        return Channels.find({active: {$ne: ""}},{
            limit: 5
        }).fetch();
    },
    setVideoStatus: function (channelSlug, status, time) {
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
    getChannel: function (channelSlug) {
        check(channelSlug, String);

        var channel = Channels.findOne({
            "slug": channelSlug
        });
        if (!channel) {
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
    register: function(username,email,password) {
        return Accounts.createUser({username:username,email: email, password: password});
    },
    addVideo: function (channelSlug, videoId) {
        YoutubeApi.videos.list({
            part: "contentDetails,snippet",
            id: videoId
        }, Meteor.bindEnvironment(function (err, data) {
            if (!err) {
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
    },
    removeVideo: function(channelSlug, videoId) {
        Videos.remove({
            channel: channelSlug,
            ytid: videoId
        });
    },
    addMessage: function (channelSlug, message) {
        var usernames = [
            "Superninja",
            "Banana",
            "Mystical Fighter",
            "Mustache",
            "Coffee King",
            "Tie Wing Fighter",
            "Giant Panda",
            "French Press",
            "Dadadada Batman",
            "Pumpkin",
            "Flash",
            "Cupperjonas98",
            "Steve Jobs",
            "xXKillerBossXx",
            "Alcatsone",
            "#hastag",
            "Glutton",
            "Horst Dieter",
            "Urban Sniper King",
            "VeryWowGuy",
            "Doge",
            "Quicksc0per",
            "ApplePwner",
            "Unicorn",
            "XboxFanboy",
            "Laz0rbeams",
            "Cake",
            "BouncyBall",
            "PwnSkillz",
            "Skillz0r",
            "Pillow",
            "FrenchPress",
            "BillyGates",
            "FireFighter",
            "Apple I",
            "JellyFish",
            "H4ckintosh",
            "Commodore",
            "FacePlant",
            "Wallh4xx0r",
            "ARAM",
            "A1mB0t"
        ];
        var username = null;
        if (Meteor.userId()) {
            username = Meteor.user().username || Meteor.user().profile.name;
        }
        if (!username) {
            var ip = this.connection.clientAddress;
            var userIndex = parseInt(ip.replace(/\./g, "")) % usernames.length;
            username = usernames[userIndex];
        }
        message = htmlEntities(message);
        Channels.update({
                    "slug": channelSlug
                },
                {
                    '$push': {
                        "messages": {
                            name: username,
                            message: message
                        }
                    }
                });

        return true;
    },
    setRight: function(channelSlug,level,right,value) {
        
        // Check for admin rights
        var channel = Channels.findOne({
            slug: channelSlug
        });
        if(getLevel(channel) !== "owner") {
            return false;
        }
        
        // Set the new right
        try {
            Rights.upsert({
                "channelSlug": channelSlug,
                "level": level,
                "right": right
            }, {
                "value": value
            });
        } catch(e) {
            return false;
        }
        
        return true;
    },
    getRights: function(channelSlug) {
        
        var channel = Channels.findOne({
            slug: channelSlug
        });
        
        var level = getLevel(channel);
        
        return Rights.find({
            channelSlug: channelSlug,
            level: level
        }).fetch();
    },
    claim: function(channelSlug) {
        var channel = Channels.findOne({
            slug: channelSlug
        });
        var ownedChannels = Channels.find({
            "owner": Meteor.userId()
        }).count();
        // Check if the channel is not already claimed and that the user can claim a new channel
        if(!channel.owner && ownedChannels <= 5) {
            Channels.update({
                slug: channelSlug
            }, {
                owner: Meteor.userId()
            });
            return true;
        }
        return false;
    },
    getClaimedChannels: function() {
        return Channels.find({
            owner: Meteor.userId()
        }).fetch();
    }
});

function getLevel(channel) {
    if(!Meteor.userId()) {
        return 'guest';
    }
    if(channel.owner == Meteor.userId()) {
        return 'owner';
    }
    if (Object.prototype.toString.call(channel.members) === '[object Array]' && channel.members.indexOf(Meteor.userId()) !== -1) {
        return 'member';
    }
    if (Object.prototype.toString.call(channel.moderators) === '[object Array]' && channel.moderators.indexOf(Meteor.userId()) !== -1) {
        return 'moderator';
    }

    return 'guest';
}

function hasRight(channelSlug,right) {
    
}

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}