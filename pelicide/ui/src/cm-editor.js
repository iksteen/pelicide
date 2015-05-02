import CodeMirror from 'codemirror/lib/codemirror';
import 'codemirror/lib/codemirror.css!';
import 'src/css/codemirror-theme.css!';

export default class CMEditor {
    constructor(editor, parent_el, content) {
        this._codeMirror = CodeMirror(
            parent_el,
            {
                value: content,
                lineWrapping: true,
                mode: this.mode,
                theme: 'pelicide'
            }
        );

        if (CodeMirror.autoLoadMode !== undefined) {
            CodeMirror.autoLoadMode(this._codeMirror, this.mode);
        }

        // Notify editor component of change.
        this._codeMirror.on('change', () => editor.change());

        // Make sure CodeMirror refreshes when the panel size changes.
        editor.pelicide.on('layout', () => this._codeMirror.refresh());

        // Sync preview scrolling
        editor.pelicide.preview.setUpScrollSync(this._codeMirror.getScrollerElement());

        // Set focus to editor widget.
        this._codeMirror.focus();
    }

    close() {
        this._codeMirror = null;
    }

    content() {
        return this._codeMirror.getValue();
    }

    get mode() { return 'text/plain'; }
    static get formats() { return []; }
    static get templates() { return {}; }
}