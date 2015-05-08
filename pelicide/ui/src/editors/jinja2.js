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
        super(editor, parent_el, content, 'htmljinja2');

        this.addActions([
            [
                {
                    icon: 'fa fa-bold',
                    hint: 'Bold',
                    key: '{meta}-B',
                    action: () => this.surround('<b>', '</b>')
                },
                {
                    icon: 'fa fa-italic',
                    hint: 'Italic',
                    key: '{meta}-I',
                    action: () => this.surround('<i>', '</i>')
                },
                {
                    icon: 'fa fa-underline',
                    hint: 'Underline',
                    key: '{meta}-U',
                    action: () => this.surround('<u>', '</u>')
                }
            ],
            [
                {
                    icon: 'fa fa-link',
                    hint: 'Insert link',
                    key: '{meta}-L',
                    action: () => this.link()
                },
                {
                    icon: 'fa fa-picture-o',
                    hint: 'Insert image',
                    key: '{meta}-O',
                    action: () => this.image()
                }
            ],
            [
                {
                    text: '<span style="color: #8d99a7">{{</span>',
                    hint: 'Insert variable',
                    key: '{meta}-[',
                    action: () => this.surround('{{ ', ' }}', 3)
                },
                {
                    text: '<span style="color: #8d99a7">{%</span>',
                    hint: 'Insert block',
                    key: '{meta}-]',
                    action: () => this.surround('{% ', ' %}', 3)
                },
                {
                    text: '<span style="color: #8d99a7">{#</span>',
                    hint: 'Insert comment',
                    key: '{meta}-;',
                    action: () => this.surround('{# ', ' #}', 3)
                }
            ]
        ]);
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

    static get formats() {
        return ['text/html'];
    }

    static get icon() { return ['fa fa-file-code-o']; }
}
