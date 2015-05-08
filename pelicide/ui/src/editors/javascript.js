import CMEditor from 'src/editors/codemirror';
import 'codemirror/mode/javascript/javascript';

export default class JSEditor extends CMEditor {
    constructor(editor, parent_el, content) {
        super(editor, parent_el, content, 'javascript');
    }

    static get formats() {
        return ['application/javascript'];
    }

    static get icon() { return ['fa fa-file-code-o']; }
}
