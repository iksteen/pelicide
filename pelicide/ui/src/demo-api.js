import Showdown from 'showdown';
import jQuery from 'jquery';


var NA_CALLS = ['restart', 'get_settings', 'set', 'build'],
    CONTENT = [
        {
            name: 'welcome-to-pelicide.md',
            url: 'http://blurringexistence.net',
            content: `Title: Welcome to pelicide
Date: 2015-04-28 08:00
Status: draft
Author: Ingmar Steen
Tags: pelicide, demo

## Welcome to the interactive Pelicide demo!

[Pelicide](https://github.com/iksteen/pelicide) is an IDE for sites built with the [Pelican Static Site Generator](http://getpelican.com). This site is an interactive demo of Pelicide's user interface.

Being a demo, this particular site is not connected to any back end so some functionality is not available:

- **All changes are volatile.** While you are able to save your changes, none of them will persist after a page reload.

- **Building HTML files is disabled.** Without building the HTML, the 'Render' preview mode is quite pointless. If you do select the Render preview mode, it shows my website instead.

- **Limited draft preview.** The renderer used for the draft preview mode in this demo is different from the one in a regular environment.

- **Markdown only.** Only markdown render support is emulated in this demo. reStructuredText is not supported.

Despite these limitations, feel free to explore the user interface! And if you like it, be sure to get [the real thing](https://github.com/iksteen/pelicide)!
`,
            meta: {
                category: 'misc'
            },
            type: 'pelican.contents.Draft',
            mimetype: 'text/x-markdown',
            dir: ['content']
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

    list_extensions() {
        return Promise.resolve(['md']);
    }

    get(key) {
        if (key == 'SITENAME') {
            return Promise.resolve('Blurring Existence');
        } else if(key == 'ARTICLE_PATHS') {
            return Promise.resolve([]);
        } else if(key == 'PAGE_PATHS') {
            return Promise.resolve(['pages']);
        } else {
            return NotSupported();
        }
    }

    render(format, content) {
        if (format == 'md' || format == 'markdown' || format == 'mdown' || format == 'mkd') {
            let pieces = content.split('\n\n');
            pieces.splice(0, 1);
            return Promise.resolve(this._showdown.makeHtml(pieces.join('\n\n')));
        }
        else
            return NotSupported();
    }

    list_files() {
        return Promise.resolve(jQuery.extend(true, [], CONTENT));
    }

    get_file(dir, name) {
        dir = dir.join('/');

        for(let node of CONTENT.values()) {
            if (node.dir.join('/') == dir && node.name == name)
                return Promise.resolve(node.content);
        }

        return Promise.reject(new Error('File not found.'));
    }

    put_file(dir, name, new_content) {
        var metadata = new_content.split('\n\n', 1)[0],
            meta = {};

        for(let piece of metadata.split('\n').values()) {
            let [key, value] = piece.split(/:\s+/);
            meta[key.toLowerCase()] = value;
        }

        var draft = meta.status == 'draft',
            page = dir && dir[0] == 'pages',
            type = page ? 'pelican.contents.Page' : draft ? 'pelican.contents.Draft' : 'pelican.contents.Article';

        for(let node of CONTENT.values()) {
            if (node.dir.join('/') == dir.join('/') && node.name == name) {
                Object.assign(node, {
                    content: new_content,
                    meta: {
                        category: meta.category || 'misc'
                    },
                    type
                });
                return Promise.resolve();
            }
        }

        CONTENT.push({
            name: name,
            url: 'http://blurringexistence.net',
            content: new_content,
            meta: {
                category: meta.category || 'misc'
            },
            mimetype: 'text/x-markdown',
            dir: dir,
            type
        });

        return Promise.resolve();
    }

    delete_file(dir, name) {
        dir = dir.join('/');

        for(let i = 0; i < CONTENT.length; ++i) {
            let node = CONTENT[i];
            if (node.dir.join('/') == dir && node.name == name) {
                CONTENT.splice(i, 1);
                return Promise.resolve();
            }
        }

        return Promise.reject(new Error('File not found.'));
    }

    rename_content(dir, oldName, newName) {
        dir = dir.join('/');

        for(let i = 0; i < CONTENT.length; ++i) {
            let node = CONTENT[i];
            if (node.dir.join('/') == dir && node.name == oldName) {
                node.name = newName;
                return Promise.resolve();
            }
        }

        return Project.reject(new Error('File not found.'));
    }
}

var api = new API();
export default api;
