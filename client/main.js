
Meteor.startup(function () {
    
    setTimeout(function() {
        // Load the IFrame Player API code asynchronously.
        var tag = document.createElement('script');
        tag.src = "http://www.youtube.com/player_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        interval = setInterval(function () {
            if (typeof YT != "undefined" && YT.loaded) {
                clearInterval(interval);
                Meteor.call('getCurrentPlaying',function(err,id) {
                    LPL.loadVideo(id);    
                });
            }
        }, 1000);
    },1000);

    var query = Configs.find({config_name: "active-title"});
    query.observeChanges({
        changed: function (id, config) {
            LPL.loadVideo(config.config_value);
        }
    });
    
    $("#add-video").click(function() {
        var url = $("#youtube-url").val();
        url = url.split("?v=");
        url = url[1];
        url = url.split("&");
        url = url[0];
        url = url.split("#");
        url = url[0];
        LPL.addVideo(url);
        $("#youtube-url").val("");
    });
    
    $("body").on("click",".delete-btn",function(e) {
        if(confirm("Sicher?")) 
        {
            var id =$(this).closest("tr").attr("id");
            Titles.remove(id);
        }
        e.preventDefault();
    });
    $("body").on("click", ".play-btn", function () {
        var id = $(this).closest("tr").attr("id");
        LPL.loadVideo(id);
    });
});
LPL = {
    player: null,
    currentTitle:null,
    progressInterval:false,
    initalPlay:false,
    loadVideo: function(id) {
        $("#ytplayer-container").html('<div id="ytplayer"></div>');
        LPL.currentTitle = id;
        Meteor.call('updateplaying',id,function(){});
        LPL.player = false;
        if(LPL.progressInterval !== false)
            clearInterval(LPL.progressInterval);
        $("#current-title-name").html("...");
        $(".currently-playing").removeClass("currently-playing");
        $("#"+LPL.currentTitle).addClass('currently-playing');
        $("#playlist").scrollTop($("#" + LPL.currentTitle).position().top-100);
        var ytid = $("#" + LPL.currentTitle).data("id");
        window.setTimeout(function() {
            new YT.Player('ytplayer', {
                height: '390',
                width: '640',
                videoId: ytid,
                events: {
                    'onReady': function(e) {
                        LPL.player = e.target;
                        LPL.player.playVideo();
                        LPL.initalPlay = true;
                    },
                    'onStateChange': function (e) {
                        if(e.data === 1) { // Play
                            if(LPL.initalPlay == true)
                            {
                                LPL.initalPlay = false;
                                LPL.player.seekTo(0);
                            }
                            $("#current-title-name").html($("#"+LPL.currentTitle).find(".title-name").html());
                            LPL.startProgressBar();       
                        }
                        if (e.data === 0) { // Finish
                            var next = $(".currently-playing").next(".title-row");
                            if(next.length)
                            {
                                var new_id = next.attr('id');
                            } else {
                                var new_id = $(".title-row:first").attr("id");
                            }
                            clearInterval(LPL.progressInterval);
                            LPL.loadVideo(new_id);
                        }
                    }
                }
            });
        },1000);
    },
    startProgressBar: function() {
        if(LPL.progressInterval !== false)
        {
            clearInterval(LPL.progressInterval);
        }
        LPL.progressInterval = setInterval(function() {
            if(!LPL.player) return;
            var percentage = (LPL.player.getCurrentTime()/LPL.player.getDuration())*100;
            $("#"+LPL.currentTitle).find(".progress-indicator").css('width',percentage+"%");    
        },200);
    },
    addVideo: function(ytid) {
        $.ajax({url:"https://gdata.youtube.com/feeds/api/videos/"+ytid+"?v=2&alt=json"}).done(function(data) {
            var title = data.entry.title.$t;
            Titles.insert({
                name: title,
                ytid: ytid
            });
        })
    }
};
