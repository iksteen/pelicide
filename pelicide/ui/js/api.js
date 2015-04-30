define([
    'jquery',
    'datagraph/jquery-jsonrpc'
], function(jQuery) {
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
            if(this._endpoint === null) {
                return Promise.reject(new Error('No API endpoint configured.'));
            }

            var endPoint = this._endpoint;
            return new Promise(function(resolve, reject) {
                jQuery.jsonRPC.request(method, {
                    endPoint: endPoint,
                    params: params,
                    success: function (r) { resolve(r.result); },
                    error: function (e) { reject(new Error(e.error.message)); }
                })
            });
        },

        configure: function (endpoint) {
            this._endpoint = endpoint;
        }
    };

    return new API();
});