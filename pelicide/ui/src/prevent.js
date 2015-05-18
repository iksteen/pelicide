var EventEmitter = {
    on(criteria, handler, once = false) {
        if (!this.handlers) {
            this.handlers = [];
        }

        this.handlers.push([criteria, handler, once]);
    },

    once(criteria, handler) {
        return this.on(criteria, handler, true);
    },

    off(criteria, handler) {
        for (let i = this.handlers.length - 1; i >= 0; --i) {
            let [h_criteria, h_handler] = this.handlers[i],
                match = true;

            if (handler === h_handler) {
                let keys = new Set(Object.getOwnPropertyNames(criteria).concat(Object.getOwnPropertyNames(h_criteria)));
                for (let key of keys) {
                    if (!criteria.hasOwnProperty(key) || !h_criteria.hasOwnProperty(key) ||  criteria[key] !== h_criteria[key]) {
                        match = false;
                        break;
                    }

                    if (match) {
                        this.handlers.splice(i, 1);
                    }
                }
            }
        }
    },

    trigger(event) {
        var handlers = [];

        for (let i = this.handlers.length - 1; i >= 0; --i) {
            let [criteria, handler, once] = this.handlers[i],
                match = true;

            for (let key in criteria) {
                if (criteria.hasOwnProperty(key) && (!event.hasOwnProperty(key) || event[key] !== criteria[key])) {
                    match = false;
                    break;
                }
            }

            if (match) {
                handlers.push(handler(event));
                if (once) {
                    this.handlers.splice(i, 1);
                }
            }
        }

        return Promise.all(handlers);
    }
};

export default EventEmitter;
