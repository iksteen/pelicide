import {alert, confirm, dialog} from 'src/util'
import API from 'src/api'
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

        var project = this;
        this._renameForm = jQuery().w2form({
            name: 'rename_file',
            style: 'border: 0px; background-color: transparent;',
            fields: [
                {field: 'filename', type: 'text', required: true, html: {caption: 'New filename', attr: 'style="width: 250px"'}}
            ],
            record: {},
            actions: {
                Cancel: function () { this.cancel(); },
                Rename: function () { this.ok(); }
            },
            onValidate: function (event) {
                var dir = this.record.dir;

                if (this.record.filename == this.record.origFilename)
                    return;

                if (project.getFile(dir, this.record.filename)) {
                    event.errors.push({
                        field: this.get('filename'),
                        error: 'File already exists'
                    });
                }
            }
        });
    }

    get layout() {
        return {
            toolbar: {
                items: [
                    {
                        type: 'button',
                        id: 'refresh',
                        icon: 'fa fa-refresh',
                        hint: `Reload project (${this.pelicide.metaKey}-Shift-L)`,
                        onClick: () => this.reload().catch(alert)
                    },
                    {
                        type: 'button',
                        id: 'rebuild',
                        icon: 'fa fa-wrench',
                        hint: `Rebuild project (${this.pelicide.metaKey}-Shift-E)`,
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
            },
            onKeydown: event => {
                let file = this._sidebar.get(this._sidebar.selected).file;
                if (file !== undefined) {
                    switch (event.originalEvent.keyCode) {
                        case 13:
                            event.preventDefault();
                            this.pelicide.editor.open(file).catch(alert);
                            break;
                        case 46:
                            event.preventDefault();
                            this.deleteFile(file).catch(alert);
                            break;
                        case 117:
                            event.preventDefault();
                            this.renameFile(file).catch(alert);
                            break;
                    }
                }
            },
            onContextMenu: event => { this._sidebar.menu = this.getMenuForNode(event.object); }
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

        /* Connect click event for sidebar menu items. */
        this._sidebar.on('menuClick', e => e.menuItem.onClick && e.menuItem.onClick(e.menuItem));

        /* Select node after opening a file. */
        this.pelicide.editor.on({type: 'open', execute: 'after'}, e => { this.selectedFile = e.file });

        /* Update node path after saving a file. */
        this.pelicide.editor.on({type: 'save', execute: 'after'}, e => this.update(e.file));

        /* Set up global hot keys. */
        this.pelicide.listen('meta shift l', () => { this.reload().catch(alert) });
        this.pelicide.listen('meta shift e', () => {
            if (!this._toolbar.get('rebuild').disabled)
                this.reload().catch(alert);
        });

        /* Load project. */
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

    getMenuForNode(item) {
        var id = 0,
            menu = [];

        if (item.file) {
            menu.push({
                id: ++id,
                text: 'Rename file',
                icon: 'fa fa-pencil-square-o',
                item: item,
                onClick: menuItem => this.renameFile(menuItem.item.file).catch(alert)
            });
            menu.push({
                id: ++id,
                text: 'Delete file',
                icon: 'fa fa-times',
                item: item,
                onClick: menuItem => this.deleteFile(menuItem.item.file).catch(alert)
            });
        }

        return menu;
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
                let parent = this._sidebar.get(node.id),
                    before = null;

                for (let sibling of parent.nodes.values()) {
                    if (sibling.file !== undefined || sibling.text.localeCompare(el) > 0) {
                        before = sibling.id;
                        break;
                    }
                }

                let id = this._newId();

                this._sidebar.insert(node.id, before, {
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

    addFile(file) {
        var path = this.pathForFile(file),
            parent = this._sidebar.get(this.ensurePath(path)),
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
            icon: file.icon || 'fa fa-file-text-o',
            file: file,
            disabled: !this.pelicide.editor.getEditor(file)
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

    renameFile(file) {
        this._renameForm.record = {
            dir: file.dir,
            filename: file.name,
            origFilename: file.name
        };

        return dialog({title: 'Rename file', form: this._renameForm})
            .then(record => {
                return API.rename_content(record.dir, record.origFilename, record.filename)
                    .then(() => {
                        this.removeFile(file);
                        file.name = record.filename;
                        this.addFile(file);
                        this.selectedFile = file;
                    });
            });
    }

    deleteFile(file) {
        return confirm(`Are you sure you want to delete ${file.name}?`)
            .then(() => this.pelicide.editor.isCurrentFile(file) ? this.pelicide.editor.close(false) : Promise.resolve(null))
            .then(() => API.delete_content(file.dir, file.name))
            .then(() => this.removeFile(file));
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
        file.icon = 'fa fa-file-o';
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

    set selectedFile(file) {
        var node = this._files[file.dir.concat([file.name]).join('/')];
        if (!node.selected) {
            this._sidebar.expandParents(node);
            this._sidebar.select(node);
            this._sidebar.scrollIntoView(node);
        }
    }

    update(file) {
        var filePath = file.dir.concat([file.name]).join('/'),
            nodePath = this.pathForFile(file).join('/');

        return API.list_content()
            .then(content => {
                for (let f of content.values()) {
                    if (f.dir.concat([f.name]).join('/') == filePath) {
                        let newPath = this.pathForFile(f);
                        if (newPath.join('/') !== nodePath) {
                            this.removeFile(file);
                            this.addFile(f);
                            this.selectedFile = f;
                        }
                        return;
                    }
                }
            });
    }

    reload() {
        return this.pelicide.editor.close()
            .then(() => {
                this._sidebar.lock('Loading...', true);
                this.clear();
                return API.list_content();
            })
            .then(content => {
                for (let file of content.values()) {
                    this.addFile(file);
                }
                this._sidebar.unlock();
            }, function (e) {
                this._sidebar.unlock();
                return Promise.reject(e);
            });
    }

    rebuild() {
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
