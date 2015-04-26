define([
    'unorm',
    'w2ui'
], function(unorm) {
    var combining = /[\u0300-\u036F]/g;
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
        },

        slugify: function (s) {
            return unorm.nfkd(s).replace(combining, '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, '-');
        }
    };

    return util;
});