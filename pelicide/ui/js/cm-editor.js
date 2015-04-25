define([
    'cm/lib/codemirror'
], function(CodeMirror) {
    function CMEditor(editor, parent_el, content) {
        /* Set up CodeMirror */
        this._codeMirror = CodeMirror(
            parent_el,
            {
                value: content,
                lineWrapping: true,
                mode: this.mode,
                theme: 'pelicide'
            }
        );
        if(CodeMirror.autoLoadMode !== undefined) {
            CodeMirror.autoLoadMode(this._codeMirror, this.mode);
        }

        // Notify editor component of change.
        this._codeMirror.on('change', function() {
            editor.change();
        });

        // Sync preview scrolling
        editor.pelicide.preview.setUpScrollSync(this._codeMirror.getScrollerElement());
    }

    CMEditor.prototype = {
        mode: 'text/plain',

        close: function() {
            this._codeMirror = null;
        },

        content: function() {
            return this._codeMirror.getValue();
        }
    };

    CMEditor.formats = [];

    return CMEditor;
});
