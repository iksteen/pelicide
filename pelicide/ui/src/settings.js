import {dialog, alert} from 'src/util';
import Cookie from 'js-cookie';
import jQuery from 'jquery';
import 'vitmalina/w2ui';


class CookieSettings {
    constructor() {
        this._data = JSON.parse(Cookie.get('pelicide-settings') || '{}');
        this._keys = new Set();
        this._fields = [];
        this._form = null;
    }

    save() {
        Cookie.set('pelicide-settings', JSON.stringify(this._data));
    }

    get(key, defaultValue) {
        return this._data.hasOwnProperty(key) ? this._data[key] : defaultValue;
    }

    set(key, value) {
        this._data[key] = value;
        Cookie.set('pelicide-settings', JSON.stringify(this._data));
    }

    register(...fields) {
        for (let field of fields) {
            if (! this._keys.has(field.name)) {
                this._keys.add(field.name);
                this._fields.push(field);
                if (!this._data.hasOwnProperty(field.name)) {
                    this._data[field.name] = field.defaultValue;
                }
            }
        }
    }

    show() {
        if (!this._form) {
            this._form = jQuery().w2form({
                name: 'settings',
                style: 'border: 0px; background-color: transparent;',
                fields: this._fields,
                record: {},
                actions: {
                    Cancel: function () { this.cancel(); },
                    OK: function () { this.ok(); }
                }
            })
        }

        this._form.record = Object.assign({}, this._data);

        return dialog({title: 'Settings', form: this._form})
            .then(record => {
                this._data = record;
                this.save();
            }).catch(alert);
    }
}

var settings = new CookieSettings();
export default settings;
