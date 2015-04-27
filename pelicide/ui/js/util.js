define([
    'jquery',
    'unorm',
    'w2ui'
], function(jQuery, unorm) {
    var combining = /[\u0300-\u036F]/g;
    var util = {
        getErrorString: function (e) {
            if (e.message)
                return e.message;
            else
                return e;
        },

        alert: function(e) {
            w2alert(util.getErrorString(e));
        },

        slugify: function (s) {
            return unorm.nfkd(s).replace(combining, '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, '-');
        },

        dialog: function (config) {
            var form = config.form;

            return new Promise(function (resolve, reject) {
                config = jQuery.extend(
                    {
                        style: 'padding: 15px 0px 0px 0px',
                        width: 500,
                        height: 300
                    },
                    config,
                    {
                        body: '<div id="popup_form_div" style="width: 100%; height: 100%;"></div>',
                        onOpen: function (event) {
                            event.onComplete = function () {
                                jQuery('#w2ui-popup').find('#popup_form_div').w2render(form);
                            }
                        },
                        onClose: function (e) {
                            if(!e.options.result) {
                                reject('cancelled');
                            } else {
                                resolve(e.options.result);
                            }
                        }
                    }
                );

                form.ok = function () {
                    if (this.validate(true).length == 0) {
                        w2popup.close({result: jQuery.extend({}, this.record)});
                        this.clear();
                    }
                };

                form.cancel = function () {
                    w2popup.close({result: null});
                    this.clear();
                };

                w2popup.open(config);
            });
        }
    };

    return util;
});