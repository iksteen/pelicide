import jQuery from 'jquery';
import Cookie from 'js-cookie';
import 'datagraph/jquery-jsonrpc';

var API_CALLS = ['restart', 'get_settings', 'get', 'set', 'list_extensions', 'build', 'render',
                 'list_files', 'get_file', 'put_file', 'delete_file', 'rename_file'];

class API {
    constructor() {
        this._endpoint = null;

        for(let e of API_CALLS.values()) {
            this[e] = (...params) => this._request(e, params);
        }
    }

    configure(endpoint) {
        this._endpoint = endpoint;
    }

    _request(method, params) {
        if(this._endpoint === null) {
            return Promise.reject(new Error('No API endpoint configured.'));
        }

        return new Promise((resolve, reject) => {
            jQuery.jsonRPC.request(method, {
                endPoint: this._endpoint,
                params: [Cookie.get('pelicide-token')].concat(params),
                success: r => resolve(r.result),
                error: e => reject(new Error(e.error.message))
            });
        });
    }
}

var api = new API();
export default api;
