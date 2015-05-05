import jQuery from 'jquery'
import unorm from 'unorm'
import 'vitmalina/w2ui'

export function getErrorString(e) {
    if (e.message)
        return e.message;
    else
        return e;
}

export function alert(e) {
    if (e) {
        return new Promise(resolve => w2alert(getErrorString(e), null, resolve));
    } else {
        return Promise.resolve();
    }
}

var combining = /[\u0300-\u036F]/g;
export function slugify(s) {
    return unorm.nfkd(s).replace(combining, '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, '-');
}

export function dialog(config) {
    var form = config.form;

    return new Promise(function (resolve, reject) {
        config = Object.assign(
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
                    if (!e.options.result) {
                        reject();
                    } else {
                        resolve(e.options.result);
                    }
                }
            }
        );

        form.ok = function () {
            if (this.validate(true).length == 0) {
                w2popup.close({result: Object.create(this.record)});
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

export function getExtension(filename) {
    var dot = filename.lastIndexOf('.');

    // >0 because of dotfiles.
    if (dot > 0)
        return filename.substring(dot + 1);
    else
        return '';
}