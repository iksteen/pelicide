import {slugify, dialog, alert} from 'js/util'
import API from 'js/api'
import jQuery from 'jquery'
import 'phstc/jquery-dateFormat'
import 'vitmalina/w2ui'

function getPathFromRecord(record) {
    return {
        path: record.create_in ? record.create_in.split('/') : [],
        name: slugify(record.title) + '.' + record.format.id
    }
}

export default class ArticleContent {
    constructor(project) {
        this.project = project;
        this._draftNodeId = null;
        this._publishedNodeId = null;
    }

    init() {
        this._draftNodeId = this.project.addContentType('Draft articles');
        this._publishedNodeId = this.project.addContentType('Published articles');

        var formats = [];
        jQuery.each(this.project.pelicide.editor.editors, (f, e) => {
            if (e.templates && e.templates.article)
                formats.push(f);
        });

        var project = this.project;
        this._form = $().w2form({
            name: 'create_article',
            style: 'border: 0px; background-color: transparent;',
            fields: [
                {field: 'title', type: 'text', required: true, html: {caption: 'Title', attr: 'style="width: 250px"'}},
                {field: 'category', type: 'combo', html: {caption: 'Category:', attr: 'style="width: 250px"'}},
                {field: 'status', type: 'list', required: true, options: {items: ['draft', 'published']}, html: {caption: 'Status', attr: 'style="width: 250px"'}},
                {field: 'format', type: 'list', required: true, options: {items: formats}, html: {caption: 'Format', attr: 'style="width: 250px"'}},
                {field: 'create_in', type: 'combo', html: {caption: 'Create in:', attr: 'style="width: 250px"'}}
            ],
            record: {},
            actions: {
                Cancel: function () { this.cancel(); },
                Create: function () { this.ok(); }
            },
            onValidate: function (event) {
                var path = getPathFromRecord(this.record);
                if (project.getFile(path.path, path.name)) {
                    event.errors.push({
                        field: this.get('title'),
                        error: 'File already exists'
                    });
                }
            }
        });

        this.project.addCreateContent({
            text: 'Create article',
            icon: 'fa fa-newspaper-o',
            onClick: () => this.create()
        });
    }

    scan(file) {
        switch (file.type) {
            case 'pelican.contents.Article':
                return [this._publishedNodeId, file.meta.category];
            case 'pelican.contents.Draft':
                return [this._draftNodeId];
        }
    }

    create() {
        var categories = this.project.categories();

        return API.get('ARTICLE_PATHS')
            .then((article_paths) => {
                this._form.set('category', {options: {items: categories}});
                this._form.set('create_in', {options: {items: article_paths}});
                this._form.record = {
                    status: 'draft',
                    format: this._form.get('format').options.items[0],
                    create_in: article_paths[0]
                };

                return dialog({
                    title: 'Create article',
                    form: this._form
                })
            })
            .then((record) => {
                jQuery.extend(record, {
                    slug: slugify(record.title),
                    date: jQuery.format.date(new Date(), 'yyyy-MM-dd HH:mm')
                });

                var path = getPathFromRecord(record),
                    body = this.project.pelicide.editor.editors[record.format.id].templates.article(record);

                return this.project.pelicide.editor.close()
                    .then(() => API.set_content(path.path, path.name, body))
                    .then(() => this.project.reload())
                    .then(() => this.project.pelicide.editor.open(path.path, path.name));
            })
            .catch(alert);
    }
}
