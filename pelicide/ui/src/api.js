import jQuery from 'jquery';
import Cookie from 'js-cookie';


var API_CALLS = ['restart', 'get_settings', 'get', 'set', 'list_extensions', 'build', 'render',
                 'list_files', 'get_file', 'put_file', 'delete_file', 'rename_file', 'can_deploy', 'deploy'];


class API {
    constructor() {
        this._endpoint = null;
        this._ready = null;
        this._requestId = 0;
        this._pending = {};

        for(let e of API_CALLS) {
            this[e] = (...params) => this._request(e, params);
        }
    }

    configure(endpoint) {
        this._endpoint = endpoint;
    }

    _connect() {
        if(this._endpoint === null) {
            return Promise.reject(new Error('No API endpoint configured.'));
        }

        this._ready = new Promise((resolve, reject) => {
            let ws = new WebSocket(this._endpoint);
            ws.onclose = () => this._ready = null;
            ws.onerror = reject;

            ws.onopen = () => {
                this._realRequest(ws, 'authenticate', [Cookie.get('pelicide-token')]).then(
                    () => { resolve(ws); },
                    e => {
                        /* Refresh authentication token cookie and retry. */
                        jQuery.get('', () => {
                            this._realRequest(ws, 'authenticate', [Cookie.get('pelicide-token')]).then(
                                () => { resolve(ws); },
                                e => { reject(new Error('Authentication failed.')); }
                            );
                        });
                    }
                );
            };

            ws.onmessage = event => {
                var message = JSON.parse(event.data),
                    [resolve, reject] = this._pending[message.id];

                delete this._pending[message.id];

                if(message.hasOwnProperty('result')) {
                    resolve(message.result);
                } else {
                    reject(new Error(message.error.message));
                }
            };
        });
    }

    _realRequest(ws, method, params) {
        let requestId = this._requestId++;

        return new Promise((resolve, reject) => {
            ws.send(JSON.stringify({
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: requestId
            }));
            this._pending[requestId] = [resolve, reject];
        });
    }

    _request(method, params) {
        if(this._ready === null) {
            this._connect();
        }

        return new Promise((resolve, reject) => {
            this._ready.then(
                ws => {
                    this._realRequest(ws, method, params).then(resolve, reject);
                    return ws;
                },
                reject
            );
        });
    }
}

var api = new API();
export default api;
