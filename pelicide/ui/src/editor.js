import {alert} from 'src/util'
import API from 'src/api'
import jQuery from 'jquery'
import 'vitmalina/w2ui'

export default class Editor {
    constructor(pelicide, {editors = []}) {
        Object.assign(this, w2utils.event);

        this.pelicide = pelicide;
        this._handlers = [];
        this._box = null;
        this._dirty = false;
        this.editors = [];
        this._types = {};
        this._editor = null;
        this._currentFile = null;

        for (let editor of editors.values()) {
            this.editors.push(editor);
            for (let format of editor.formats.values()) {
                this._types[format] = editor;
            }
        }
    }

    get layout() {
        return {
            toolbar: {
                items: [
                    {
                        type: 'button',
                        id: 'save',
                        disabled: true,
                        icon: 'fa fa-save',
                        hint: 'Save',
                        onClick: () => this.save().catch(alert)
                    },
                    {
                        type: 'button',
                        id: 'rebuild_page',
                        icon: 'fa fa-wrench',
                        hint: 'Rebuild page',
                        disabled: true,
                        onClick: () => this.rebuild().catch(alert)
                    },
                    {type: 'spacer', id: 'editor_spacer'}
                ]
            }
        };
    }

    render(box, toolbar) {
        this._box = box;
        this._toolbar = toolbar;

        this.pelicide.project.on('update', (event) => {
            if (this._currentFile === null)
                return;

            var file = event.target,
                path = file.dir.concat([file.name]).join('/');

            if (this._currentFile.dir.concat([self._currentFile.name]).join('/') == path) {
                this._currentFile = file;
            }
        });
    }

    addEditorToolbarItem(item) {
        if (! this._toolbar.get('editor_break')) {
            this._toolbar.insert('editor_spacer', {
                type: 'break',
                id: 'editor_break',
                editorItem: true
            });
        }
        this._toolbar.insert('editor_spacer', Object.assign({type: 'button', editorItem: true}, item));
    }

    addEditorToolbarItems(items) {
        for (let item of items.values()) {
            this.addEditorToolbarItem(item);
        }
    }

    removeEditorToolbarItems() {
        var editorItems = [];
        for(let i = this._toolbar.items.length - 1; i >= 0; --i) {
            let item = this._toolbar.items[i];
            if(item && item.editorItem)
                this._toolbar.remove(item.id);
        }
    }

    getEditor(file) {
        var editor = this._types[file.mimetype];
        if (typeof editor == 'undefined') {
            editor = this._types[file.mimetype.split('/')[0]];
        }
        return editor ? editor : null;
    }

    change() {
        this.dirty = true;
        this.trigger({ type: 'change', phase: 'after', target: this });
    }

    get dirty() {
        return this._dirty;
    }

    set dirty(dirty) {
        if(dirty == this._dirty)
            return;

        var eventData = { type: 'dirty', phase: 'before', target: this, dirty: dirty };

        this.trigger(eventData);
        if (eventData.isCancelled === true) return;

        this._dirty = dirty;
        this._toolbar.set('save', {disabled: !dirty});

        this.trigger(Object.assign(eventData, { phase: 'after' }))
    }

    get state() {
        return (this._editor === null) ? null : {
            file: this._currentFile,
            content: this._editor.content()
        };
    }

    open(file) {
        if (!file) {
            return Promise.reject(new Error('File not found.'));
        }

        var editor = this.getEditor(file);

        if (!editor) {
            return Promise.reject(new Error('No editor is registered for this file type.'));
        }

        var eventData = { type: 'open', phase: 'before', target: this, file: file };
        this.trigger(eventData);
        if (eventData.isCancelled === true) {
            return Promise.reject();
        }

        return this.close()
            .then(() => API.get_content(file.dir, file.name))
            .then(content => {
                this._currentFile = file;
                this._editor = new editor(this, this._box, content);

                this._toolbar.enable('rebuild_page');

                this.trigger(Object.assign(eventData, { phase: 'after', success: true }));
            })
            .catch(e => {
                this.trigger(Object.assign(eventData, { phase: 'after', success: false, error: e }));
                return Promise.reject(e);
            });
    }

    save() {
        if(this._editor === null) {
            return Promise.resolve();
        }

        var eventData = {type: 'save', phase: 'before', target: this, file: this._currentFile};
        this.trigger(eventData);
        if (eventData.isCancelled) {
            return Promise.reject();
        }

        return API.set_content(this._currentFile.dir, this._currentFile.name, this._editor.content())
            .then(() => {
                this.trigger(Object.assign(eventData, { phase: 'after', success: true }));
                this.dirty = false;
            }, e => {
                this.trigger(Object.assign(eventData, { phase: 'after', success: false, error: e }));
                return Promise.reject(e);
            });
    }

    close() {
        if (this._editor === null) {
            return Promise.resolve();
        }

        var eventData = { type: 'close', phase: 'before', target: this, file: this._currentFile };
        this.trigger(eventData);
        if (eventData.isCancelled === true) {
            return Promise.reject();
        }

        var _close = () => {
            this.removeEditorToolbarItems();
            this._toolbar.disable('rebuild_page');
            this._editor.close();
            this._editor = null;
            this._currentFile = null;
            jQuery(this._box).empty();
            this.trigger(Object.assign(eventData, { phase: 'after', success: true }));
        };

        if (!this.dirty) {
            _close();
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            jQuery().w2popup({
                title: 'Confirm close',
                width: 450,
                height: 220,
                body: '<div class="w2ui-centered w2ui-confirm-msg" style="font-size: 13px;">' +
                      '<p>The content of the currently opened file has changed.</p>' +
                      '<p>Are you sure you want to close this file?</p></div>',
                buttons: '<button value="save" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Save</button>' +
                         '<button value="discard" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Discard</button>' +
                         '<button value="cancel" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Cancel</button>',

                onOpen: (event) => {
                    event.onComplete = () => {
                        $('.px-confirm-close').on('click', (event) => {
                            w2popup.close();

                            var result = $(event.target).val();
                            switch (result) {
                                case 'save':
                                    resolve(this.save().then(_close));
                                    break;
                                case 'discard':
                                    this.dirty = false;
                                    _close();
                                    resolve();
                                    break;
                                default:
                                    this.trigger(Object.assign(eventData, { phase: 'after', success: false }));
                                    reject();
                            }
                        });
                    };
                }
            });
        });
    }

    rebuild() {
        var state = this.state;

        this._toolbar.disable('rebuild_page');

        if (!state)
            return Promise.reject(new Error('No open file.'));

        var eventData = {
            type: 'rebuild',
            phase: 'before',
            target: this,
            onComplete: () => {
                this._toolbar.set('rebuild_page', {disabled: this._editor === null});
            }
        };
        this.trigger(eventData);
        if (eventData.isCancelled === true) {
            eventData.onComplete();
            return Promise.reject();
        }

        return this.save()
            .then(() => { return API.build([[state.file.dir, state.file.name]]); })
            .then(() => { this.trigger(Object.assign(eventData, { phase: 'after', success: true })); })
            .catch(e => {
                this.trigger(Object.assign(eventData, { phase: 'after', success: false, error: e }));
                return Promise.reject(e);
            });
    }
}
