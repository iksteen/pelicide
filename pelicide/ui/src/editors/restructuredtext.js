import CMEditor from 'src/editors/codemirror';
import 'codemirror/mode/rst/rst';

export default class RSTEditor extends CMEditor {
    constructor(editor, parent_el, content) {
        super(editor, parent_el, content, 'rst');

        var ctrl = this.ctrlOrCmd;

        editor.addEditorToolbarItems([
            {
                id: 'md_bold',
                icon: 'fa fa-bold',
                hint: `Bold (${ctrl}B)`,
                onClick: () => this.bold()
            },
            {
                id: 'md_italic',
                icon: 'fa fa-italic',
                hint: `Italic (${ctrl}I)`,
                onClick: () => this.italic()
            },
            {type: 'break', id: 'md_break_1'},
            {
                id: 'md_link',
                icon: 'fa fa-link',
                hint: `Insert link (${ctrl}L)`,
                onClick: () => this.link()
            },
            {
                id: 'md_ul',
                icon: 'fa fa-list-ul',
                hint: `Unordered list item (${ctrl}U)`,
                onClick: () => this.ul()
            }
        ]);

        this._codeMirror.setOption("extraKeys", {
            [ctrl + 'B']: () => this.bold(),
            [ctrl + 'I']: () => this.italic(),
            [ctrl + 'L']: () => this.link(),
            [ctrl + 'U']: () => this.ul()
        });
    }

    bold() {
        this.surround('**');
    }

    italic() {
        this.surround('*');
    }

    link() {
        var doc = this._codeMirror.getDoc();
        if (doc.somethingSelected()) {
            let text = doc.getSelection();
            if (/^\w+:\/\/|^mailto:/.test(text))
                this.surround('` <', '>`_', text.length + 5);
            else
                this.surround('`', ' <http://>`_', 3);
        }
        else
            this.insert('` <http://>`_', 12);
    }

    ul() {
        this.replaceLinePrefix(/^\s*[*+-]\s/, match => match ? '': '* ');
    }

    static get formats() {
        return ['text/x-rst'];
    }

    static get extensions() {
        return ['rst'];
    }

    static get templates() {
        function template(record) {
            return `${record.title}
${'#'.repeat(record.title.length)}

:date: ${record.date}
:status: ${record.status.id}
:tags: `+ (record.category ? `
:category: ${record.category}` : '') + `
:slug: ${record.slug}

`;
        }

        return {
            article: template,
            page: template
        }
    }
}
