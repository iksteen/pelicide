import CMEditor from 'src/editors/codemirror';
import 'codemirror/mode/markdown/markdown';


function template(record) {
    return `Title: ${record.title}
Date: ${record.date}
Status: ${record.status.id}
Tags:`  + (record.category ? `
Category: ${record.category}` : '') + `
Slug: ${record.slug}

`;
}


export default class MDEditor extends CMEditor {
    constructor(editor, parent_el, content) {
        super(editor, parent_el, content, 'markdown');

        this.addActions([
            [
                {
                    icon: 'fa fa-bold',
                    hint: 'Bold',
                    key: '{meta}-B',
                    action: () => this.surround('**')
                },
                {
                    icon: 'fa fa-italic',
                    hint: 'Italic',
                    key: '{meta}-I',
                    action: () => this.surround('*')
                },
                {
                    icon: 'fa fa-header',
                    hint: 'Heading',
                    key: '{meta}-H',
                    action: () => this.header()
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
                    icon: 'fa fa-image',
                    hint: 'Insert image',
                    key: '{meta}-O',
                    action: () => this.image()
                },
                {
                    icon: 'fa fa-list-ul',
                    hint: 'Unordered list item',
                    key: '{meta}-U',
                    action: () => this.ul()
                }
            ]
        ]);
    }

    static get formats() {
        return ['text/x-markdown', 'text/x-rmarkdown'];
    }

    static get extensions() {
        return ['md', 'markdown', 'mkd', 'mdown', 'rmd'];
    }

    static get templates() {
        return {
            article: template,
            page: template
        }
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
            this.insert('![]()', 3);
    }

    ul() {
        this.replaceLinePrefix(/^\s*[*+-]\s/, match => match ? '': '* ');
    }
}
