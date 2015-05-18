import {alert} from 'src/util'
import API from 'src/api'
import settings from 'src/settings'
import EventEmitter from 'src/prevent'
import jQuery from 'jquery'
import 'vitmalina/w2ui'


settings.register(
    {
        name: 'autoSaveInterval',
        defaultValue: 0,
        type: 'int',
        options: {
            min: 0
        },
        html: {
            caption: 'Auto save every',
            text: '&nbsp;second(s) (use 0 to disable).'
        }
    }
);


export default class Editor {
    constructor(pelicide, {editors = []}) {
        Object.assign(this, EventEmitter);

        this.pelicide = pelicide;
        this._handlers = [];
        this._box = null;
        this._dirty = false;
        this._autoSavePending = null;
        this.editors = [];
        this._types = {};
        this._editor = null;
        this._currentFile = null;

        for (let editor of editors) {
            this.editors.push(editor);
            for (let format of editor.formats) {
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
                        hint: `Save (${this.pelicide.metaKey}-S)`,
                        onClick: () => this.save().catch(alert)
                    },
                    {
                        type: 'button',
                        id: 'rebuild_page',
                        icon: 'fa fa-wrench',
                        hint: `Rebuild page (${this.pelicide.metaKey}-E)`,
                        disabled: true,
                        onClick: () => this.rebuild().catch(alert)
                    },
                    {type: 'spacer', id: 'editor_spacer'}
                ]
            }
        };
    }

    isCurrentFile(file) {
        return file && this._currentFile &&
            this._currentFile.dir.concat([this._currentFile.name]).join('/') == file.dir.concat([file.name]).join('/');
    }

    render(box, toolbar) {
        this._box = box;
        this._toolbar = toolbar;

        this.pelicide.project.on('update', ({target: file}) => {
            if (this.isCurrentFile(file)) {
                this._currentFile = file;
            }
        });

        /* Connect events to toolbar button states. */
        this.on({type: 'rebuild', execute: 'before'}, () => this._toolbar.set('rebuild_page', {disabled: true}));
        this.on({type: 'rebuild', execute: 'after'}, () =>
            this._toolbar.set('rebuild_page', {disabled: this._editor === null || this._currentFile.dir[0] != 'content'})
        );
        this.on({type: 'open', execute: 'after', success: true}, ({file}) => {
            if (file.dir[0] == 'content') {
                this._toolbar.enable('rebuild_page');
            }
        });
        this.on({type: 'dirty'}, ({dirty}) => this._toolbar.set('save', {disabled: !dirty}));

        /* Set up global hot keys. */
        this.pelicide.listen('meta s', () => {
            if (!this._toolbar.get('save').disabled) {
                this.save().catch(alert);
            }
        });
        this.pelicide.listen('meta e', () => {
            if (!this._toolbar.get('rebuild_page').disabled) {
                this.rebuild().catch(alert);
            }
        });

        /* Set up periodic auto-save. */
        this.on({type: 'change'}, () => {
            if (settings.get('autoSaveInterval') && !this.isCurrentFile(this._autoSavePending)) {
                this._autoSavePending = this._currentFile;

                setTimeout(() => {
                    if (this.isCurrentFile(this._autoSavePending)) {
                        this._autoSavePending = null;
                        this.save();
                    }
                }, settings.get('autoSaveInterval') * 1000);
            }
        });
    }

    addEditorToolbarItem(item) {
        this._toolbar.insert('editor_spacer', Object.assign({type: 'button', editorItem: true}, item));
    }

    addEditorToolbarItems(items) {
        for (let item of items) {
            this.addEditorToolbarItem(item);
        }
    }

    removeEditorToolbarItems() {
        var editorItems = [];
        for(let i = this._toolbar.items.length - 1; i >= 0; --i) {
            let item = this._toolbar.items[i];
            if(item && item.editorItem) {
                this._toolbar.remove(item.id);
            }
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
        this.trigger({type: 'change', target: this});
    }

    get dirty() {
        return this._dirty;
    }

    set dirty(dirty) {
        if(dirty == this._dirty) {
            return;
        }

        this._dirty = dirty;
        this.trigger({type: 'dirty', target: this, dirty: dirty});
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

        var eventData = {type: 'open', execute: 'before', target: this, file: file};
        return this.trigger(eventData)
            .then(() => this.close())
            .then(() => API.get_file(file.dir, file.name))
            .then(content => {
                this._currentFile = file;
                this._editor = new editor(this, this._box, content);
            })
            .then(
                () => this.trigger(Object.assign(eventData, {execute: 'after', success: true})),
                e => {
                    this.trigger(Object.assign(eventData, {execute: 'after', success: false, error: e}));
                    return Promise.reject(e);
                }
            );
    }

    save() {
        if(this._editor === null) {
            return Promise.resolve();
        }

        var eventData = {type: 'save', execute: 'before', target: this, file: this._currentFile};
        return this.trigger(eventData)
            .then(() => API.put_file(this._currentFile.dir, this._currentFile.name, this._editor.content()))
            .then(
                () => {
                    this.dirty = false;
                    this.trigger(Object.assign(eventData, {execute: 'after', success: true}));
                }, e => {
                    this.trigger(Object.assign(eventData, {execute: 'after', success: false, error: e}));
                    return Promise.reject(e);
                }
            );
    }

    _checkClose(saveBeforeClose) {
        if (!this.dirty || !saveBeforeClose) {
            return Promise.resolve();
        }

        if (settings.get('autoSaveInterval')) {
            return this.save();
        }

        return new Promise((resolve, reject) => jQuery().w2popup({
            title: 'Confirm close',
            width: 450,
            height: 220,
            body: '<div class="w2ui-centered w2ui-confirm-msg" style="font-size: 13px;">' +
                  '<p>The content of the currently opened file has changed.</p>' +
                  '<p>Are you sure you want to close this file?</p></div>',
            buttons: '<button value="save" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Save</button>' +
                     '<button value="discard" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Discard</button>' +
                     '<button value="cancel" class="w2ui-popup-btn w2ui-btn px-confirm-close" style="width: 80px; margin: 0 10px">Cancel</button>',

            onOpen: event => {
                event.onComplete = () => {
                    jQuery('.px-confirm-close').on('click', event => {
                        w2popup.close();

                        var result = jQuery(event.target).val();
                        switch (result) {
                            case 'save':
                                resolve(this.save());
                                break;
                            case 'discard':
                                this.dirty = false;
                                resolve();
                                break;
                            default:
                                reject();
                        }
                    });
                };
            }
        }));
    }

    close(saveBeforeClose = true) {
        if (this._editor === null) {
            return Promise.resolve();
        }

        var eventData = {type: 'close', execute: 'before', target: this, file: this._currentFile, saveBeforeClose};
        return this.trigger(eventData)
            .then(() => this._checkClose(saveBeforeClose))
            .then(() => {
                this.removeEditorToolbarItems();
                this._editor.close();
                this._editor = null;
                this._currentFile = null;
                jQuery(this._box).empty();
            })
            .then(
                () => this.trigger(Object.assign(eventData, {execute: 'after', success: true})),
                e => {
                    this.trigger(Object.assign(eventData, {execute: 'after', success: false, error: e}));
                    return Promise.reject(e);
                }
            );
    }

    rebuild() {
        var state = this.state;
        if (!state) {
            return Promise.reject(new Error('No open file.'));
        }

        var eventData = {type: 'rebuild', execute: 'before', target: this};
        return this.trigger(eventData)
            .then(() => this.save())
            .then(() => API.build([[state.file.dir, state.file.name]]))
            .then(
                () => this.trigger(Object.assign(eventData, {execute: 'after', success: true})),
                e => {
                    this.trigger(Object.assign(eventData, {execute: 'after', success: false, error: e}));
                    return Promise.reject(e);
                }
            );
    }
}
