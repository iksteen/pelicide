import CMEditor from 'src/editors/codemirror';
import 'codemirror/mode/css/css';

export default class CSSEditor extends CMEditor {
    constructor(editor, parent_el, content) {
        super(editor, parent_el, content, 'css');
    }

    static get formats() {
        return ['text/css'];
    }

    static get icon() { return ['fa fa-file-code-o']; }
}
