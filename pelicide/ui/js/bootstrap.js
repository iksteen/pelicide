import jQuery from 'jquery';
import API from 'js/api';
import Pelicide from 'js/pelicide';
import {alert} from 'js/util';
import ArticleContent from 'js/article-content';
import MDEditor from 'js/md-editor';
import RSTEditor from 'js/rst-editor';

export function bootstrap() {
    // Set up API endpoint.
    API.configure('/rpc');

    // Start Pelicide UI when DOM is ready.
    jQuery(function () {
        API.get('SITENAME').then(function (sitename) {
            document.title = sitename + ' (Pelicide)';

            // Set up and start Pelicide UI.
            var pelicide = new Pelicide({
                sitename: sitename || '',
                contentTypes: [
                    ArticleContent
                ],
                editors: [
                    MDEditor,
                    RSTEditor
                ]
            });
            pelicide.run('#main_layout');
            // Uncomment the next line to automatically open the demo document.
            //setTimeout(function () { pelicide.editor.open([], 'welcome-to-pelicide.md'); }, 0);
        }).catch(alert);
    });
}
