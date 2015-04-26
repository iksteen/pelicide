define([
    'rsvp',
    'jquery',
    'jquery_jsonrpc'
], function(RSVP, jQuery) {

    var API_CALLS = ['restart', 'get_settings', 'get', 'set', 'list_extensions', 'build', 'render',
                     'list_content', 'get_content', 'set_content'];

    function API() {
        var self = this;

        this._endpoint = null;

        jQuery.each(API_CALLS, function (i, e) {
            self[e] = function () {
                return self._request(e, jQuery.makeArray(arguments));
            }
        });
    }

    API.prototype = {
        _request: function (method, params) {
            var self = this;

            return new RSVP.Promise(function(resolve, reject) {
                if(self._endpoint === null) {
                    reject('No endpoint configured.');
                    return;
                }

                jQuery.jsonRPC.request(method, {
                    endPoint: self._endpoint,
                    params: params,
                    success: function (r) { resolve(r.result); },
                    error: function (e) { reject(e); }
                })
            });
        },

        configure: function (endpoint) {
            this._endpoint = endpoint;
        }
    };

    return new API();
});