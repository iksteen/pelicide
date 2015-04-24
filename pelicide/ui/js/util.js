define([
    'w2ui'
], function() {

    var util = {
        getErrorString: function (e) {
            if(e.error) {
                if(e.error.message !== undefined)
                    return e.error.message;
                else
                    return e.error;
            }
            else
                return e;
        },

        alert: function(e) {
            w2alert(util.getErrorString(e));
        }
    };

    return util;
});