import Showdown from 'showdown';

var NA_CALLS = ['restart', 'get_settings', 'set', 'list_extensions', 'build'],
    CONTENT = [
        {
            "status": "draft",
            "name": "welcome-to-pelicide.md",
            "url": "http://blurringexistence.net",
            "content": "Title: Welcome to pelicide\nDate: 2015-04-28 08:00\nStatus: draft\nAuthor: Ingmar Steen\nTags: pelicide, demo\n\n## Welcome to the interactive Pelicide demo!\n\n[Pelicide](https://github.com/iksteen/pelicide) is an IDE for sites built with the [Pelican Static Site Generator](http://getpelican.com). This site is an interactive demo of Pelicide's user interface.\n\nBeing a demo, this site is not connected to any back end so some functionality is not available:\n\n- **All changes are volatile.** While you are able to save your changes, none of them will persist after a page reload.\n- **Building HTML files is disabled.** Without building the HTML, the 'Render' preview mode is quite pointless. If you do select the Render preview mode, it shows my website instead.\n- **Limited draft preview.** The renderer used for the draft preview mode in this demo is different from the one in a regular environment. The metadata shows up at the top, there's no code highlighting, etc.",
            "meta": {
                "category": "misc",
                "title": "Welcome to Pelicide",
                "author": "Ingmar Steen",
                "reader": "markdown",
                "date": "2015-04-28 08:00:00",
                "slug": "welcome-to-pelicide",
                "tags": ["pelicide", "demo"]
            },
            "type": "pelican.contents.Draft",
            "mimetype": "text/x-markdown",
            "dir": []
        }
    ];

function NotSupported() {
    return Promise.reject(new Error('This functionality is not available in demo mode.'));
}

class API {
    constructor() {
        this._showdown = new Showdown.converter();

        for(let e of NA_CALLS.values())
            this[e] = NotSupported;
    }

    configure(endpoint) {}

    get(key) {
        if (key == 'SITENAME') {
            return Promise.resolve('Blurring Existence');
        } else if(key == 'ARTICLE_PATHS') {
            return Promise.resolve([]);
        } else {
            return NotSupported();
        }
    }

    render(format, content) {
        if (format == 'md' || format == 'markdown' || format == 'mdown')
            return Promise.resolve(this._showdown.makeHtml(content));
        else
            return NotSupported();
    }

    list_content() {
        return Promise.resolve(CONTENT);
    }

    get_content(dir, name) {
        dir = dir.join('/');

        for(let node of CONTENT.values()) {
            if (node.dir.join('/') == dir && node.name == name)
                return Promise.resolve(node.content);
        }

        return Promise.reject(new Error('File not found.'));
    }

    set_content(dir, name, new_content) {
        dir = dir.join('/');

        for(let node of CONTENT.values()) {
            if (node.dir.join('/') == dir && node.name == name) {
                node.content = new_content;
                return Promise.resolve();
            }
        }

        return Promise.reject(new Error('Cannot create new files in demo mode.'));
    }
}

var api = new API();
export default api;
