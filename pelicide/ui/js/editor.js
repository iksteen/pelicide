define([
    'js/util',
    'js/api',
    'jquery',
    'w2ui'
], function(Util, API, jQuery) {

    function Editor(pelicide, editors) {
        this.pelicide = pelicide;

        this.handlers = [];
        this._box = null;
        this._dirty = false;
        this.editors = {};
        this._editor = null;
        this._currentFile = null;
        this._currentMode = null;

        for (i = 0; i < editors.length; ++i) {
            var editor = editors[i];
            for (var j = 0; j < editor.formats.length; ++j) {
                this.editors[editor.formats[j]] = editor;
            }
        }
    }

    Editor.prototype = {
        layout: function () {
            var self = this;

            return {
                toolbar: {
                    items: [
                        {
                            type: 'button',
                            id: 'save',
                            disabled: true,
                            icon: 'fa fa-save',
                            hint: 'Save',
                            onClick: function () { self.save(); }
                        },
                        {
                            type: 'button',
                            id: 'rebuild_page',
                            icon: 'fa fa-wrench',
                            hint: 'Rebuild page',
                            disabled: true,
                            onClick: function () { self.rebuild(); }
                        }
                    ]
                }
            };
        },

        render: function (box, toolbar) {
            this._box = box;
            this._toolbar = toolbar;
        },

        getEditor: function (filename) {
            var dot = filename.lastIndexOf('.'),
                mode = '';

            /* >0 because of dotfiles */
            if (dot > 0) {
                mode = filename.substring(dot + 1);
            } else {
                mode = '';
            }

            var editor = this.editors[mode];
            return editor ? { mode: mode,  class: editor } : null;
        },

        change: function() {
            this.dirty(true);
            this.trigger({ type: 'change', phase: 'after', target: this });
        },

        dirty: function (dirty) {
            if(arguments.length === 0)
                return this._dirty;

            if(dirty == this._dirty)
                return;

            var eventData = { type: 'dirty', phase: 'before', target: this, dirty: dirty };

            this.trigger(eventData);
            if (eventData.isCancelled === true) return;

            this._dirty = dirty;
            this._toolbar.set('save', {disabled: !dirty});

            this.trigger(jQuery.extend(eventData, { phase: 'after' }))
        },

        state: function () {
            if (this._editor === null)
                return null;

            return {
                file: this._currentFile,
                mode: this._currentMode,
                content: this._editor.content()
            };
        },

        open: function (file, success) {
            var self = this,
                editor = this.getEditor(file.name);

            if (!editor) {
                w2alert('No editor is registered for this file type.', 'Unknown file type');
                return;
            }

            var eventData = { type: 'open', phase: 'before', target: this, file: file };
            this.trigger(eventData);
            if (eventData.isCancelled === true) return;

            this.close().then(function() {
                return API.get_content(file.dir, file.name).then(function (content) {
                    self._currentFile = file;
                    self._currentMode = editor.mode;
                    self._editor = new editor.class(self, self._box, content);

                    self._toolbar.enable('rebuild_page');

                    self.trigger(jQuery.extend(eventData, { 'phase': 'after', success: true }));

                    success && success();
                });
            }, function () {
                /* Consume close dialog cancellation. */
            }).catch(function (e) {
                self.trigger(jQuery.extend(eventData, { 'phase': 'after', success: false, error: e }));
                Util.alert(e);
            });
        },

        save: function (success) {
            var self = this,
                oldDirty = this.dirty();

            if(this._editor !== null) {
                var eventData = { type: 'save', phase: 'before', target: this, file: this._currentFile };
                this.trigger(eventData);
                if (eventData.isCancelled === true) return;

                API.set_content(this._currentFile.dir, this._currentFile.name, this._editor.content()).then(function () {
                    self.trigger(jQuery.extend(eventData, { 'phase': 'after', success: true }));
                    self.dirty(false);
                    success && success();
                }, function (e) {
                    self.dirty(oldDirty);
                    self.trigger(jQuery.extend(eventData, { 'phase': 'after', success: false, error: e }));
                    Util.alert(e);
                });
            } else {
                success && success();
            }
        },

        close: function() {
            var self = this;
            var eventData = { type: 'close', phase: 'before', target: this, file: this._currentFile };

            if (this._editor === null) {
                return Promise.resolve();
            }

            return new Promise(function (resolve, reject) {
                function _close() {
                    self._toolbar.disable('rebuild_page');
                    self._editor.close();
                    self._editor = null;
                    self._currentFile = null;
                    self._currentMode = null;
                    jQuery(self._box).empty();
                    self.trigger(jQuery.extend(eventData, { phase: 'after', success: true }));
                    resolve();
                }

                self.trigger(eventData);
                if (eventData.isCancelled === true) {
                    reject('cancelled');
                    return;
                }

                if(self.dirty()) {
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
                        onOpen: function (event) {
                            event.onComplete = function() {
                                $('.px-confirm-close').on('click', function(event) {
                                    w2popup.close({result: $(event.target).val()});
                                });
                            };
                        },
                        onClose: function (event) {
                            var result = event.options.result;

                            if(result == 'save') {
                                self.save(function () {
                                    _close();
                                });
                            } else if(result == 'discard') {
                                self.dirty(false);
                                _close();
                            } else {
                                self.trigger(jQuery.extend(eventData, { phase: 'after', success: false }));
                                reject('cancelled');
                            }
                        }
                    });
                } else {
                    _close();
                }
            });
        },

        rebuild: function () {
            var self = this,
                state = this.state();

            this._toolbar.disable('rebuild_page');

            if (state) {
                var eventData = {
                    type: 'rebuild-page',
                    phase: 'before',
                    target: this,
                    onComplete: function() {
                        self._toolbar.set('rebuild_page', {disabled: self._editor === null});
                    }
                };
                this.trigger(eventData);
                if (eventData.isCancelled === true) {
                    eventData.onComplete();
                    return;
                }

                this.save(function () {
                    API.build([[state.file.dir, state.file.name]]).then(function () {
                        self.trigger(jQuery.extend(eventData, { phase: 'after', success: true }));
                    }, function (e) {
                        self.trigger(jQuery.extend(eventData, { phase: 'after', success: false, error: e }));
                        Util.alert(e);
                    });
                });
            }
        }
    };
    jQuery.extend(Editor.prototype, w2utils.event);

    return Editor;
});
