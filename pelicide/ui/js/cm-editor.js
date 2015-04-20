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
                theme: 'cobalt'
            }
        );
        if(CodeMirror.autoLoadMode !== undefined) {
            CodeMirror.autoLoadMode(this._codeMirror, this.mode);
        }

        // Schedule preview update on content changes
        this._codeMirror.on('change', $.proxy(pelicide.schedulePreview, pelicide));

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
