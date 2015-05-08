import CodeMirror from 'codemirror/lib/codemirror';
import CMEditor from 'src/editors/codemirror';
import 'codemirror/addon/mode/overlay';
import 'codemirror/mode/jinja2/jinja2';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';

CodeMirror.defineMode('htmljinja2', function(config, parserConfig) {
    return CodeMirror.overlayMode(
        CodeMirror.getMode(config, parserConfig.backdrop || 'text/html'),
        CodeMirror.getMode(config, 'jinja2')
    );
});

export default class Jinja2Editor extends CMEditor {
    constructor(editor, parent_el, content) {
        super(editor, parent_el, content);

        var ctrl = this.ctrlOrCmd;

        editor.addEditorToolbarItems([
            {
                id: 'j2_bold',
                icon: 'fa fa-bold',
                hint: `Bold (${ctrl}B)`,
                onClick: () => this.bold()
            },
            {
                id: 'j2_italic',
                icon: 'fa fa-italic',
                hint: `Italic (${ctrl}I)`,
                onClick: () => this.italic()
            },
            {
                id: 'j2_underline',
                icon: 'fa fa-underline',
                hint: `Underline (${ctrl}U)`,
                onClick: () => this.underline()
            },
            {type: 'break', id: 'jd_break_1'},
            {
                id: 'j2_link',
                icon: 'fa fa-link',
                hint: `Insert link (${ctrl}L)`,
                onClick: () => this.link()
            },
            {
                id: 'j2_image',
                icon: 'fa fa-picture-o',
                hint: `Insert image (${ctrl}O)`,
                onClick: () => this.image()
            },
            {type: 'break', id: 'j2_break_2'},
            {
                id: 'j2_bb',
                text: '<span style="color: #8d99a7">{{</span>',
                hint: `Insert {{ }} (${ctrl}[)`,
                onClick: () => this.bb()
            },
            {
                id: 'j2_bp',
                text: '<span style="color: #8d99a7">{%</span>',
                hint: `Insert {% %} (${ctrl}])`,
                onClick: () => this.bp()
            }
        ]);

        this._codeMirror.setOption("extraKeys", {
            [ctrl + 'B']: () => this.bold(),
            [ctrl + 'I']: () => this.italic(),
            [ctrl + 'U']: () => this.underline(),
            [ctrl + 'L']: () => this.link(),
            [ctrl + 'O']: () => this.image(),
            [ctrl + '[']: () => this.bb(),
            [ctrl + ']']: () => this.bp()
        });
    }

    bold() {
        this.surround('<b>', '</b>');
    }

    italic() {
        this.surround('<i>', '</i>');
    }

    underline() {
        this.surround('<u>', '</u>');
    }

    link() {
        var doc = this._codeMirror.getDoc();
        if (doc.somethingSelected()) {
            let text = doc.getSelection();
            if (/^\w+:\/\/|^mailto:/.test(text))
                this.surround('<a href="', '"></a>', 4);
            else
                this.surround('<a href="http://">', '</a>', text.length + 6);
        }
        else
            this.insert('<a href="http://"></a>', 6);
    }

    image() {
        var doc = this._codeMirror.getDoc();
        if (doc.somethingSelected()) {
            let text = doc.getSelection();
            if (/^\w+:\/\//.test(text))
                this.surround('<img alt="', '" src=""/>', 3);
            else
                this.surround('<img alt="" src="', '"/>', text.length + 10);
        }
        else
            this.insert('<img alt="" src=""/>', 10);
    }

    bb() {
        this.surround('{{ ', ' }}', 3);
    }

    bp() {
        this.surround('{% ', ' %}', 3);
    }

    get mode() { return 'htmljinja2'; }

    static get formats() {
        return ['text/html'];
    }

    static get icon() { return ['fa fa-file-code-o']; }
}
