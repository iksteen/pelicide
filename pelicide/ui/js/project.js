import {alert} from 'js/util'
import API from 'js/api'
import jQuery from 'jquery'
import 'vitmalina/w2ui'


export default class Project {
    constructor(pelicide, {sitename = '', contentTypes = []}) {
        Object.assign(this, w2utils.event);

        this.pelicide = pelicide;
        this._sitename = sitename;
        this.handlers = [];
        this._sidebar = null;
        this._box = null;
        this._toolbar = null;

        this._contentTypes = [];
        for (let contentType of contentTypes.values())
            this._contentTypes.push(new contentType(this));

        this._id = 0;
        this._paths = {};
        this._files = {};

        this._otherContentId = null;
    }

    layout() {
        return {
            toolbar: {
                items: [
                    {
                        type: 'button',
                        id: 'refresh',
                        icon: 'fa fa-refresh',
                        hint: 'Reload project',
                        onClick: () => this.reload().catch(alert)
                    },
                    {
                        type: 'button',
                        id: 'rebuild',
                        icon: 'fa fa-wrench',
                        hint: 'Rebuild project',
                        onClick: () => this.rebuild().catch(alert)
                    },
                    { type: 'break' },
                    {
                        type: 'menu',
                        id: 'create',
                        icon: 'fa fa-plus',
                        disabled: true,
                        hint: 'Create content',
                        items: []
                    }
                ]
            }
        };
    }

    render(box, toolbar) {
        this._box = box;
        this._toolbar = toolbar;

        this._sidebar = jQuery().w2sidebar({
            name: 'project',
            nodes: [
                {
                    id: 'content',
                    text: this._sitename || 'Content',
                    expanded: true,
                    group: true
                }
            ],
            onDblClick: event => {
                var file = this._sidebar.get(event.target).file;
                if (file !== undefined) {
                    this.pelicide.editor.open(file).catch(alert);
                }
            }
        });
        this._sidebar.render(box);

        this.clear();

        /* Initialise content type plugins. */
        for(let contentType of this._contentTypes.values()) {
            contentType.init();
        }
        this._otherContentId = this.addContentType('Other');

        /* Connect click event for create content menu. */
        this._toolbar.on('click', e => {
            if(e.item && e.item.type == 'menu' && e.subItem && e.subItem.onClick) {
                e.subItem.onClick(e);
            }}
        );

        /* Select node after opening a file. */
        this.pelicide.editor.on({type: 'open', execute: 'after'}, e => this.select(e.file));

        /* Update node path after saving a file. */
        this.pelicide.editor.on({type: 'save', execute: 'after'}, e => this.update(e.file));

        this.reload().catch(alert);
    }

    _newId() {
        return 'node_' + (++this._id);
    }

    clear() {
        this._paths = {
            nodes: {
                content: {
                    id: 'content',
                    nodes: {}
                }
            }
        };
        this._files = {};

        var contentChildren=this._sidebar.find({
            parent: this._sidebar.get('content')
        });
        for(let node of contentChildren.values()) {
            /* Remove all nodes below the content type node. */
            this._sidebar.remove.apply(
                this._sidebar,
                this._sidebar.find(node, {}).map(function (e) {
                    return e.id;
                })
            );

            /* Re-register path for the content type node. */
            this._paths.nodes.content.nodes[node.id] = {
                id: node.id,
                nodes: {}
            }
        }
    }

    get contentTitle() {
        return this._sidebar.get('content').text;
    }

    set contentTitle(text) {
        this._sidebar.get('content').text = (text === null) ? 'Content' : text;
        this._sidebar.refresh('content');

    }

    addContentType(text) {
        var id = this._newId();

        this._sidebar.add('content', {
            id: id,
            text: text,
            icon: 'fa fa-folder'
        });

        this._paths.nodes.content.nodes[id] = {
            id: id,
            nodes: {}
        };

        return id;
    }

    addCreateContent(item) {
        var id = this._newId(),
            items = this._toolbar.get('create').items;

        items.push(Object.assign({}, item, { id: id }));
        this._toolbar.set('create', {
            disabled: false,
            items: items
        });
    }

    ensurePath(path) {
        var node = this._paths;

        for(let i = 0; i < path.length; ++i) {
            let el = path[i];

            if (node.nodes.hasOwnProperty(el)) {
                node = node.nodes[el];
            } else {
                let id = this._newId();

                this._sidebar.add(node.id, {
                    id: id,
                    text: el,
                    icon: 'fa fa-folder-o'
                });

                node = node.nodes[el] = {
                    id: id,
                    nodes: {}
                };
            }
        }

        return node.id;
    }

    addFile(path, file, icon) {
        var parent = this._sidebar.get(this.ensurePath(path)),
            id = this._newId(),
            before = null;

        for (let sibling of parent.nodes.values()) {
            if (sibling.file !== undefined && sibling.text.localeCompare(file.name) > 0) {
                before = sibling.id;
                break;
            }
        }

        this._sidebar.insert(parent, before, {
            id: id,
            text: file.name,
            icon: 'fa fa-file-text-o',
            file: file,
            disabled: !this.pelicide.editor.getEditor(file.name)
        });

        this._files[file.dir.concat([file.name]).join('/')] = id;

        this.trigger({ type: 'update', target: file });

        return id;
    }

    removeFile(file) {
        var path = file.dir.concat([file.name]).join('/'),
            id = this._files[path];

        this._sidebar.remove(id);
        delete this._files[path];
    }

    getFile(dir, filename) {
        var node = this._sidebar.get(this._files[dir.concat([filename]).join('/')]);
        return node ? node.file : null;
    }

    pathForFile(file) {
        for (let contentType of this._contentTypes.values()) {
            let path = contentType.scan(file);
            if (path !== undefined) {
                return ['content'].concat(path);
            }
        }
        return ['content', this._otherContentId].concat(file.dir);
    }

    get categories() {
        var categories = new Set();
        for (let node of this._sidebar.find({}).values()) {
            if (node.file !== undefined)
                categories.add(node.file.meta.category);
        }
        return Array.from(categories);
    }

    select(file) {
        var node = this._files[file.dir.concat([file.name]).join('/')];
        this._sidebar.expandParents(node);
        this._sidebar.select(node);
        this._sidebar.scrollIntoView(node);
    }

    update(file) {
        var filePath = file.dir.concat([file.name]).join('/'),
            nodePath = this.pathForFile(file).join('/');

        return API.list_content()
            .then((content) => {
                for (let f of content.values()) {
                    if (f.dir.concat([f.name]).join('/') == filePath) {
                        var newPath = this.pathForFile(f);
                        if (newPath.join('/') !== nodePath) {
                            this.removeFile(file);
                            this.addFile(newPath, f);
                            this.select(f);
                        }
                        return;
                    }
                }
            });
    }

    reload() {
        var addContentNodes = (items) => {
            /* Sort items by path and file name. */
            items.sort(function (a, b) {
                var n = Math.min(a.path.length, b.path.length);
                for (var i = 0; i < n; ++i) {
                    var c = a.path[i].localeCompare(b.path[i]);
                    if(c)
                        return c;
                }

                if (a.path.length < b.path.length)
                    return -1;
                else if (a.length > b.length)
                    return 1;
                else
                    return a.file.name.localeCompare(b.file.name);
            });

            /* Create nodes for all content items */
            for(var i = 0; i < items.length; ++i) {
                var item = items[i];
                this.addFile(item.path, item.file);
            }
        };

        return this.pelicide.editor.close()
            .then(() => {
                this._sidebar.lock('Loading...', true);
                this.clear();
                return API.list_content();
            })
            .then(content => {
                var items = [];

                for (var file of content.values()) {
                    items.push({
                        path: this.pathForFile(file),
                        file: file
                    });
                }

                addContentNodes(items);

                this._sidebar.unlock();
            }, function (e) {
                this._sidebar.unlock();
                return Promise.reject(e);
            });
    }

    rebuild() {
        var self = this;

        this._toolbar.disable('rebuild');

        var eventData = {
            type: 'rebuild',
            phase: 'before',
            target: this,
            onComplete: () => {
                this._toolbar.enable('rebuild');
            }
        };
        this.trigger(eventData);
        if (eventData.isCancelled === true) {
            eventData.onComplete();
            return Promise.reject();
        }

        return this.pelicide.editor.save()
            .then(() => { return API.build(); })
            .then(() => {
                this.trigger(Object.assign(eventData, { phase: 'after', success: true }));
            }, e => {
                this.trigger(Object.assign(eventData, { phase: 'after', success: false, error: e }));
                return Promise.reject(e);
            });
    }
}
