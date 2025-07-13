export class MentionWrapper extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.listenerSelector = 'input[type=text], textarea, [contenteditable]';

        const style = document.createElement('style');
        style.textContent = `
        :host {
          display: block;
          width: 320px;
          min-height: 2em;
          position: relative;
        }
        ul {
          margin: 0;
          padding: 0;
          list-style: none;
          background: #333;
          border: 1px solid #555;
          color: #eee;
          position: fixed;
          z-index: 9999;
          display: none;
          max-height: 150px;
          overflow-y: auto;
        }
        li {
          padding: 0.3em 0.5em;
          cursor: pointer;
        }
        li.highlighted {
          background: #666;
        }
      `;
        this.shadowRoot.appendChild(style);

        const slot = document.createElement('slot');
        this.shadowRoot.appendChild(slot);

        this.menu = document.createElement('ul');
        this.shadowRoot.appendChild(this.menu);

        this.query = '';
        this.mentionActive = false;
        this.highlightedIndex = -1;

        // Bindings
        this.handleKeyup = this.handleKeyup.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.closeMenu = this.closeMenu.bind(this);
    }

    connectedCallback() {
        this.inputs = Array.from(this.querySelectorAll(this.listenerSelector));
        if (this.inputs.length === 0) {
            throw new Error(`mention-wrapper must contain at least one element matching selector: ${this.listenerSelector}`);
        }

        this.inputs.forEach(input => {
            input.addEventListener('keyup', this.handleKeyup);
            input.addEventListener('keydown', this.handleKeydown);
            input.addEventListener('blur', this.closeMenu);
        });

        this.menu.addEventListener('mousedown', this.handleClick);
    }

    disconnectedCallback() {
        this.inputs.forEach(input => {
            input.removeEventListener('keyup', this.handleKeyup);
            input.removeEventListener('keydown', this.handleKeydown);
            input.removeEventListener('blur', this.closeMenu);
        });
        this.menu.removeEventListener('mousedown', this.handleClick);
    }

    async handleKeyup(e) {
        const input = e.target;
        const text = this.getTextBeforeCaret(input);
        const mentionMatch = text.match(/@(\w*)$/);

        if (mentionMatch) {
            this.query = mentionMatch[1];
            try {
                const suggestions = await this.fetchSuggestions(this.query);
                if (suggestions.length > 0) {
                    this.renderMenu(suggestions);
                    this.openMenuAtCaret(input);
                    this.highlightedIndex = 0;
                    this.updateHighlight();
                    this.mentionActive = true;
                } else {
                    this.closeMenu();
                }
            } catch (err) {
                console.error('fetchSuggestions error:', err);
                this.closeMenu();
            }
        } else {
            this.closeMenu();
        }
    }

    handleKeydown(e) {
        if (!this.mentionActive) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.highlightedIndex = (this.highlightedIndex + 1) % this.menu.children.length;
            this.updateHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.highlightedIndex = (this.highlightedIndex - 1 + this.menu.children.length) % this.menu.children.length;
            this.updateHighlight();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (this.highlightedIndex >= 0 && this.highlightedIndex < this.menu.children.length) {
                const mention = this.menu.children[this.highlightedIndex].textContent;
                this.insertMentionAtCaret(mention);
                this.closeMenu();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.closeMenu();
        }
    }

    handleClick(e) {
        e.preventDefault(); // prevent blur
        if (e.target.tagName.toLowerCase() === 'li') {
            const mention = e.target.textContent;
            this.insertMentionAtCaret(mention);
            this.closeMenu();
        }
    }

    getTextBeforeCaret(input) {
        if (input.nodeName === 'INPUT' || input.nodeName === 'TEXTAREA') {
            return input.value.slice(0, input.selectionStart);
        } else {
            const selection = window.getSelection();
            if (!selection.rangeCount) return '';
            const range = selection.getRangeAt(0);
            const preRange = range.cloneRange();
            preRange.selectNodeContents(input);
            preRange.setEnd(range.endContainer, range.endOffset);
            return preRange.toString();
        }
    }

    // Show menu aligned at caret position
    openMenuAtCaret(input) {
        const caretCoords = this.getCaretCoordinates(input);
        if (!caretCoords) {
            // fallback to input bottom-left corner
            const rect = input.getBoundingClientRect();
            this.menu.style.left = `${rect.left}px`;
            this.menu.style.top = `${rect.bottom}px`;
        } else {
            this.menu.style.left = `${caretCoords.left}px`;
            this.menu.style.top = `${caretCoords.top}px`;
        }
        this.menu.style.display = 'block';
    }

    getCaretCoordinates(el) {
        if (el.nodeName === 'INPUT' || el.nodeName === 'TEXTAREA') {
            return this.getInputCaretCoordinates(el);
        } else {
            return this.getContentEditableCaretCoordinates(el);
        }
    }

    getInputCaretCoordinates(el) {
        // use a hidden div to measure caret position inside input or textarea
        // adapted from https://github.com/component/textarea-caret-position

        const div = document.createElement('div');
        document.body.appendChild(div);

        const style = window.getComputedStyle(el);
        const properties = [
            'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
            'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
            'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform',
            'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing',
            'tabSize', 'MozTabSize'
        ];

        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        properties.forEach(prop => {
            div.style[prop] = style[prop];
        });

        div.textContent = el.value.substring(0, el.selectionStart);

        const span = document.createElement('span');
        span.textContent = el.value.substring(el.selectionStart) || '.';
        div.appendChild(span);

        const rect = span.getBoundingClientRect();
        const divRect = div.getBoundingClientRect();

        document.body.removeChild(div);

        return {
            left: rect.left,
            top: rect.top + window.scrollY + 20 // +20 px to show below caret, tweak if needed
        };
    }

    getContentEditableCaretCoordinates(el) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        const range = selection.getRangeAt(0).cloneRange();
        range.collapse(true);
        const rects = range.getClientRects();
        if (rects.length === 0) {
            // fallback
            const elRect = el.getBoundingClientRect();
            return { left: elRect.left, top: elRect.bottom };
        }
        const rect = rects[0];
        return { left: rect.left, top: rect.bottom };
    }

    renderMenu(items) {
        this.menu.innerHTML = '';
        for (const item of items) {
            const li = document.createElement('li');
            li.textContent = item;
            this.menu.appendChild(li);
        }
    }

    updateHighlight() {
        const children = Array.from(this.menu.children);
        children.forEach((li, i) => {
            li.classList.toggle('highlighted', i === this.highlightedIndex);
        });
    }

    insertMentionAtCaret(mention) {
        // Find focused input or fallback
        const activeInput = document.activeElement;
        const input = (this.inputs.includes(activeInput)) ? activeInput : this.inputs[0];

        if (!input) return;

        if (input.nodeName === 'INPUT' || input.nodeName === 'TEXTAREA') {
            const start = input.selectionStart;
            const value = input.value.slice(0, start);
            const after = input.value.slice(start);

            // Replace @query with mention + space
            const newValue = value.replace(/@(\w*)$/, mention + ' ');
            input.value = newValue + after;

            // Move caret after inserted mention
            input.selectionStart = input.selectionEnd = newValue.length;
            input.focus();
        }

        else {
            // contenteditable
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const range = selection.getRangeAt(0);

            const textBefore = this.getTextBeforeCaret(input);
            const match = textBefore.match(/@(\w*)$/);
            if (!match) return;

            const charsToDelete = match[0].length;
            range.setStart(range.endContainer, range.endOffset - charsToDelete);
            range.deleteContents();

            const node = this.onMentionInsert(mention);
            range.insertNode(node);

            // Insert a space text node after the mention node
            const spaceNode = document.createTextNode('\u00A0');
            node.parentNode.insertBefore(spaceNode, node.nextSibling);

            // Move caret after the space node
            range.setStartAfter(spaceNode);
            range.collapse(true);

            selection.removeAllRanges();
            selection.addRange(range);

            input.focus();

        }
    }

    closeMenu() {
        this.menu.style.display = 'none';
        this.mentionActive = false;
        this.highlightedIndex = -1;
    }

    /**
     * 
     * @param {*} query 
     * @example 
     *      return (await this.fetchData()).filter(name => name.toLowerCase().startsWith(query.toLowerCase()));
     */
    async fetchSuggestions(query) {
        throw new TypeError('No fetchSuggestions property was assigned.');
    }

    /**
     * 
     * @param {*} word 
     * @example 
     *      return document.createTextNode(word);
     */
    onMentionInsert(word) {
        throw new TypeError('No onMentionInsert property was assigned.');
    }
}

customElements.define('mention-wrapper', MentionWrapper);
