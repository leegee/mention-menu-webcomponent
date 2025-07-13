# `mention-wrapper`

[Demo at https://leegee.github.io/mention-menu-webcomponent](https://leegee.github.io/mention-menu-webcomponent)

## Synopsis

    <head>
        <script type="module">
            import FAKE_DATA from './names.js'
            import { MentionWrapper } from './mention-wrapper.js';

            const mention = document.getElementById('my-mention-wrapper');

            mention.fetchSuggestions = async function (query) {
                return FAKE_DATA.filter(name => name.toLowerCase().startsWith(query.toLowerCase()));
            };

            mention.onMentionInsert = (word) => {
                const span = document.createElement('mark');
                span.textContent = word;
                span.contentEditable = false
                return span;
            };
        </script>
    </head>
    <body>
        <mention-wrapper id="my-mention-wrapper">
            <input type="text" placeholder="Try typing '@' here" />
            <div contenteditable="false">Or try typing '@' here!</div>
        </mention-wrapper>
    </body>

## Feature

Creates `@mention` lists when the user types a `@` within the element, a list is shown of next ot the caret.

Override the `fetchSuggestions` method to fetch data for the suggestions list, and override `onMentionInsert` with a routine that accepts a word that is in the process of being inserted to replace the user's (likely partially-complete) query,  and returns a new `HTMLElement`. 

Thus after typing `@a`, when a suggestion is shown, code could insert a name, a name linked to a `VCard`, an image, a music player, another HTML page...