import {slugify, dialog, alert} from 'src/util'
import API from 'src/api'
import jQuery from 'jquery'
import 'phstc/jquery-dateFormat'
import 'vitmalina/w2ui'

function getPathFromRecord(record) {
    return {
        path: record.create_in ? record.create_in.split('/') : [],
        name: slugify(record.title) + '.' + record.extension.id
    }
}

export default class ArticleContent {
    constructor(project) {
        this.project = project;
        this._draftNodeId = null;
        this._publishedNodeId = null;
        this._templates = {};
    }

    init() {
        this._draftNodeId = this.project.addContentType('Draft articles');
        this._publishedNodeId = this.project.addContentType('Published articles');

        API.list_extensions()
            .then((pelican_extensions) => {
                pelican_extensions = new Set(pelican_extensions);

                var extensions = [];
                for(let e of this.project.pelicide.editor.editors) {
                    if (e.templates && e.templates.article) {
                        let template = e.templates.article;
                        for (let extension of e.extensions.values()) {
                            if (pelican_extensions.has(extension)) {
                                this._templates[extension] = template;
                                extensions.push(extension);
                            }
                        }
                    }
                }

                var project = this.project;
                this._form = $().w2form({
                    name: 'create_article',
                    style: 'border: 0px; background-color: transparent;',
                    fields: [
                        {field: 'title', type: 'text', required: true, html: {caption: 'Title', attr: 'style="width: 250px"'}},
                        {field: 'category', type: 'combo', html: {caption: 'Category:', attr: 'style="width: 250px"'}},
                        {field: 'status', type: 'list', required: true, options: {items: ['draft', 'published']}, html: {caption: 'Status', attr: 'style="width: 250px"'}},
                        {field: 'extension', type: 'list', required: true, options: {items: extensions}, html: {caption: 'File type', attr: 'style="width: 250px"'}},
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
        var categories = this.project.categories;

        return API.get('ARTICLE_PATHS')
            .then(article_paths => {
                this._form.set('category', {options: {items: categories}});
                this._form.set('create_in', {options: {items: article_paths}});
                this._form.record = {
                    status: 'draft',
                    extension: this._form.get('extension').options.items[0],
                    create_in: article_paths[0]
                };

                return dialog({
                    title: 'Create article',
                    form: this._form
                })
            })
            .then(record => {
                Object.assign(record, {
                    slug: slugify(record.title),
                    date: jQuery.format.date(new Date(), 'yyyy-MM-dd HH:mm')
                });

                var path = getPathFromRecord(record),
                    body = this._templates[record.extension.id](record);

                return this.project.pelicide.editor.close()
                    .then(() => API.set_content(path.path, path.name, body))
                    .then(() => this.project.reload())
                    .then(() => this.project.pelicide.editor.open(this.project.getFile(path.path, path.name)));
            })
            .catch(alert);
    }
}
