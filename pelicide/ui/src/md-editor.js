import CMEditor from 'src/cm-editor';
import 'codemirror/mode/markdown/markdown';

export default class MDEditor extends CMEditor {
    constructor(editor, parent_el, content) {
        super(editor, parent_el, content);

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
            {
                id: 'md_header',
                icon: 'fa fa-header',
                hint: `Header (${ctrl}H)`,
                onClick: () => this.header()
            },
            {type: 'break', id: 'md_break_1'},
            {
                id: 'md_link',
                icon: 'fa fa-link',
                hint: `Insert link (${ctrl}L)`,
                onClick: () => this.link()
            },
            {
                id: 'md_image',
                icon: 'fa fa-picture-o',
                hint: `Insert image (${ctrl}O)`,
                onClick: () => this.image()
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
            [ctrl + 'H']: () => this.header(),
            [ctrl + 'L']: () => this.link(),
            [ctrl + 'O']: () => this.image(),
            [ctrl + 'U']: () => this.ul()
        });
    }

    bold() {
        this.surround('**');
    }

    italic() {
        this.surround('*');
    }

    header() {
        this.replaceLinePrefix(/(#+)\s+/, match =>
            match ? (match[1].length >= 6 ? '' : '#'.repeat(match[1].length + 1) + ' ') : '# '
        );
    }

    link() {
        var doc = this._codeMirror.getDoc();
        if (doc.somethingSelected()) {
            let text = doc.getSelection();
            if (/^\w+:\/\/|^mailto:/.test(text))
                this.surround('[](', ')', text.length + 3);
            else
                this.surround('[', '](http://)', 1);
        }
        else
            this.insert('[](http://)', 10);
    }

    image() {
        var doc = this._codeMirror.getDoc();
        if (doc.somethingSelected()) {
            let text = doc.getSelection();
            if (/^\w+:\/\//.test(text))
                this.surround('![](', ')', text.length + 3);
            else
                this.surround('![', ']()', 1);
        }
        else
            this.insert('[]()', 3);
    }

    ul() {
        this.replaceLinePrefix(/^\s*[*+-]\s/, match => match ? '': '* ');
    }

    get mode() { return 'markdown'; }

    static get formats() {
        return ['text/x-markdown'];
    }

    static get extensions() {
        return ['md', 'markdown', 'mdown'];
    }

    static get templates() {
        return {
            article(record) {
                return `Title: ${record.title}
Date: ${record.date}
Status: ${record.status.id}
Tags:`  + (record.category ? `
Category: ${record.category}` : '') + `
Slug: ${record.slug}

`;
            }
        }
    }
}
