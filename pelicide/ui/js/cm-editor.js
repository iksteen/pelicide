define([
    'cm/lib/codemirror'
], function(CodeMirror) {
    function CMEditor(pelicide, parent_el, content) {
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

        // Mark dirty and schedule preview update on content changes
        this._codeMirror.on('change', $.proxy(function() {
            this.dirty(true);
            this.schedulePreview();
        }, pelicide));

        // Sync preview scrolling
        pelicide.setUpPreviewScrollSync(this._codeMirror.getScrollerElement());
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
