define([
    'js/util',
    'jquery',
    'jquery_jsonrpc',
    'w2ui'
], function(Util, jQuery) {

    function Editor(pelicide, editors) {
        this.pelicide = pelicide;

        this.handlers = [];
        this._box = null;
        this._dirty = false;
        this._editors = {};
        this._editor = null;
        this._currentFile = null;
        this._currentMode = null;

        for (i = 0; i < editors.length; ++i) {
            var editor = editors[i];
            for (var j = 0; j < editor.formats.length; ++j) {
                this._editors[editor.formats[j]] = editor;
            }
        }
    }

    Editor.prototype = {
        create: function (box) {
            this._box = box;
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

            var editor = this._editors[mode];
            return editor ? { mode: mode,  class: editor } : null;
        },

        dirty: function (dirty) {
            if(arguments.length === 0)
                return this._dirty;

            var eventData = { type: 'dirty', phase: 'before', target: this, dirty: dirty };

            this.trigger(eventData);
            if (eventData.isCancelled === true) return;

            this._dirty = dirty;

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

            this.close(function() {
                jQuery.jsonRPC.request('get_content', {
                    params: [file.dir, file.name],
                    success: function (result) {
                        self._currentFile = file;
                        self._currentMode = editor.mode;
                        self._editor = new editor.class(self.pelicide, self._box, result.result);

                        self.trigger(jQuery.extend(eventData, { 'phase': 'after' }));

                        success && success();
                    },
                    error: Util.alert
                });
            });
        },

        save: function (success) {
            var self = this,
                oldDirty = this.dirty();

            if(this._editor !== null) {
                var eventData = { type: 'save', phase: 'before', target: this, file: this._currentFile };
                this.trigger(eventData);
                if (eventData.isCancelled === true) return;

                jQuery.jsonRPC.request('set_content', {
                    params: [this._currentFile.dir, this._currentFile.name, this._editor.content()],
                    success: function() {
                        self.trigger(jQuery.extend(eventData, { 'phase': 'after' }));
                        self.dirty(false);
                        success && success();
                    },
                    error: function (e) {
                        self.dirty(oldDirty);
                        Util.alert(e);
                    }
                });
            } else {
                success && success();
            }
        },

        close: function(success) {
            var self = this;
            var eventData = { type: 'close', phase: 'before', target: this, file: this._currentFile };

            function _close() {
                self._editor.close();
                self._editor = null;
                self._currentFile = null;
                self._currentMode = null;
                jQuery(self._box).empty();
                self.trigger(jQuery.extend(eventData, { phase: 'after' }));
                success && success();
            }

            if (this._editor !== null) {
                this.trigger(eventData);
                if (eventData.isCancelled === true) return;

                if(this.dirty()) {
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
                        onOpen: function() {
                            setTimeout(function() {
                                $('.px-confirm-close').on('click', function(event) {
                                    var result=$(event.target).val();

                                    w2popup.close();

                                    if(result == 'save') {
                                        self.save(function () {
                                            _close();
                                        });
                                    } else if(result == 'discard') {
                                        self.dirty(false);
                                        _close();
                                    }
                                });
                            }, 0);
                        }
                    });
                } else {
                    _close();
                }
            } else {
                success && success();
            }
        }
    };
    jQuery.extend(Editor.prototype, w2utils.event);

    return Editor;
});