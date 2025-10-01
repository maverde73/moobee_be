/**
 * Document Parser Service
 * Estrae testo strutturato da PDF, Word e altri formati
 * Il testo estratto viene poi inviato a Python per l'analisi
 */

const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');

class DocumentParserService {
    constructor() {
        this.supportedFormats = {
            'pdf': this.extractFromPDF,
            'doc': this.extractFromDOC,
            'docx': this.extractFromDOCX,
            'txt': this.extractFromTXT,
            'rtf': this.extractFromRTF,
            'odt': this.extractFromODT
        };

        // Configurazione estrazione
        this.config = {
            minTextLength: 100,
            maxTextLength: 100000,
            preserveFormatting: true,
            extractMetadata: true
        };
    }

    /**
     * Metodo principale per estrarre testo da un file
     * @param {string|Buffer} input - Path del file o Buffer
     * @param {string} fileType - Estensione del file (pdf, docx, etc.)
     * @returns {Object} Testo estratto e metadata
     */
    async extractText(input, fileType) {
        try {
            console.log(`Extracting text from ${fileType} file`);

            // Normalizza il tipo di file
            const extension = fileType.toLowerCase().replace('.', '');

            // Verifica se il formato è supportato
            if (!this.supportedFormats[extension]) {
                throw new Error(`Unsupported file format: ${extension}`);
            }

            // Determina se l'input è un path o un buffer
            let buffer;
            let metadata = {
                fileType: extension,
                extractionDate: new Date().toISOString()
            };

            if (typeof input === 'string') {
                // È un path - leggi il file
                buffer = await fs.readFile(input);
                metadata.fileName = path.basename(input);
                metadata.filePath = input;

                const stats = await fs.stat(input);
                metadata.fileSize = stats.size;
                metadata.lastModified = stats.mtime;
            } else if (Buffer.isBuffer(input)) {
                // È già un buffer
                buffer = input;
                metadata.fileSize = buffer.length;
            } else {
                throw new Error('Input must be a file path or Buffer');
            }

            // Estrai il testo usando il metodo appropriato
            const extractor = this.supportedFormats[extension].bind(this);
            const result = await extractor(buffer, metadata);

            // Valida il risultato
            if (!result.text || result.text.length < this.config.minTextLength) {
                throw new Error(`Extracted text too short (minimum ${this.config.minTextLength} characters)`);
            }

            if (result.text.length > this.config.maxTextLength) {
                console.warn(`Text truncated to ${this.config.maxTextLength} characters`);
                result.text = result.text.substring(0, this.config.maxTextLength);
                result.truncated = true;
            }

            // Pulisci e struttura il testo
            result.text = this.cleanAndStructureText(result.text);

            // Aggiungi statistiche
            result.statistics = this.calculateStatistics(result.text);

            return {
                success: true,
                ...result
            };

        } catch (error) {
            console.error('Document extraction error:', error);
            return {
                success: false,
                error: error.message,
                text: null
            };
        }
    }

    /**
     * Estrae testo da PDF
     * @private
     */
    async extractFromPDF(buffer, metadata) {
        try {
            const data = await pdfParse(buffer, {
                // Opzioni per migliorare l'estrazione
                max: 0, // no limit on pages
                version: 'v2.0.550'
            });

            // Aggiungi metadata specifici del PDF
            metadata.pages = data.numpages;
            metadata.info = data.info;
            metadata.pdfVersion = data.version;

            // Estrai testo preservando la struttura
            let structuredText = data.text;

            // Se possibile, estrai anche il testo per pagina
            const textByPage = [];
            if (data.pages) {
                data.pages.forEach((page, index) => {
                    if (page.text) {
                        textByPage.push({
                            page: index + 1,
                            text: page.text
                        });
                    }
                });
            }

            return {
                text: structuredText,
                metadata: metadata,
                textByPage: textByPage.length > 0 ? textByPage : undefined,
                raw: {
                    numPages: data.numpages,
                    info: data.info
                }
            };

        } catch (error) {
            throw new Error(`PDF extraction failed: ${error.message}`);
        }
    }

    /**
     * Estrae testo da DOCX (Word moderno)
     * @private
     */
    async extractFromDOCX(buffer, metadata) {
        try {
            const result = await mammoth.extractRawText({
                buffer: buffer
            });

            // Estrai anche con formattazione HTML per preservare la struttura
            const htmlResult = await mammoth.convertToHtml({
                buffer: buffer
            });

            // Rimuovi tag HTML base ma preserva struttura
            const structuredText = this.htmlToStructuredText(htmlResult.value);

            metadata.format = 'docx';
            metadata.messages = result.messages;

            return {
                text: structuredText || result.value,
                metadata: metadata,
                raw: {
                    plainText: result.value,
                    html: htmlResult.value,
                    messages: result.messages
                }
            };

        } catch (error) {
            throw new Error(`DOCX extraction failed: ${error.message}`);
        }
    }

    /**
     * Estrae testo da DOC (Word legacy)
     * @private
     */
    async extractFromDOC(buffer, metadata) {
        return new Promise((resolve, reject) => {
            textract.fromBufferWithMime(
                'application/msword',
                buffer,
                {
                    preserveLineBreaks: true,
                    preserveOnlyMultipleLineBreaks: false
                },
                (error, text) => {
                    if (error) {
                        reject(new Error(`DOC extraction failed: ${error.message}`));
                    } else {
                        metadata.format = 'doc';
                        resolve({
                            text: text,
                            metadata: metadata,
                            raw: {
                                plainText: text
                            }
                        });
                    }
                }
            );
        });
    }

    /**
     * Estrae testo da file TXT
     * @private
     */
    async extractFromTXT(buffer, metadata) {
        try {
            const text = buffer.toString('utf8');

            metadata.format = 'txt';
            metadata.encoding = 'utf8';

            return {
                text: text,
                metadata: metadata,
                raw: {
                    plainText: text
                }
            };

        } catch (error) {
            // Prova con altri encoding se UTF-8 fallisce
            try {
                const text = buffer.toString('latin1');
                metadata.encoding = 'latin1';
                return {
                    text: text,
                    metadata: metadata
                };
            } catch {
                throw new Error(`TXT extraction failed: ${error.message}`);
            }
        }
    }

    /**
     * Estrae testo da RTF
     * @private
     */
    async extractFromRTF(buffer, metadata) {
        return new Promise((resolve, reject) => {
            textract.fromBufferWithMime(
                'application/rtf',
                buffer,
                {
                    preserveLineBreaks: true
                },
                (error, text) => {
                    if (error) {
                        reject(new Error(`RTF extraction failed: ${error.message}`));
                    } else {
                        metadata.format = 'rtf';
                        resolve({
                            text: text,
                            metadata: metadata,
                            raw: {
                                plainText: text
                            }
                        });
                    }
                }
            );
        });
    }

    /**
     * Estrae testo da ODT (OpenDocument)
     * @private
     */
    async extractFromODT(buffer, metadata) {
        return new Promise((resolve, reject) => {
            textract.fromBufferWithMime(
                'application/vnd.oasis.opendocument.text',
                buffer,
                {
                    preserveLineBreaks: true
                },
                (error, text) => {
                    if (error) {
                        reject(new Error(`ODT extraction failed: ${error.message}`));
                    } else {
                        metadata.format = 'odt';
                        resolve({
                            text: text,
                            metadata: metadata,
                            raw: {
                                plainText: text
                            }
                        });
                    }
                }
            );
        });
    }

    /**
     * Converte HTML in testo strutturato preservando sezioni
     * @private
     */
    htmlToStructuredText(html) {
        if (!html) return '';

        // Rimuovi script e style
        let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // Preserva interruzioni di riga per paragrafi e headers
        text = text.replace(/<\/p>/gi, '\n\n');
        text = text.replace(/<br\s*\/?>/gi, '\n');
        text = text.replace(/<\/h[1-6]>/gi, '\n\n');
        text = text.replace(/<h[1-6][^>]*>/gi, '\n\n');

        // Preserva liste
        text = text.replace(/<li[^>]*>/gi, '\n• ');
        text = text.replace(/<\/li>/gi, '');

        // Rimuovi tutti gli altri tag HTML
        text = text.replace(/<[^>]+>/g, '');

        // Decodifica entità HTML
        text = this.decodeHTMLEntities(text);

        // Pulisci spazi multipli
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/[ \t]+/g, ' ');

        return text.trim();
    }

    /**
     * Decodifica entità HTML
     * @private
     */
    decodeHTMLEntities(text) {
        const entities = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&nbsp;': ' ',
            '&euro;': '€',
            '&pound;': '£',
            '&copy;': '©',
            '&reg;': '®'
        };

        for (const [entity, char] of Object.entries(entities)) {
            text = text.replace(new RegExp(entity, 'g'), char);
        }

        // Decodifica entità numeriche
        text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

        return text;
    }

    /**
     * Pulisce e struttura il testo estratto
     * @private
     */
    cleanAndStructureText(text) {
        if (!text) return '';

        // Normalizza line endings
        text = text.replace(/\r\n/g, '\n');
        text = text.replace(/\r/g, '\n');

        // Rimuovi caratteri di controllo (eccetto newline e tab)
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        // Rimuovi spazi all'inizio e fine di ogni riga
        text = text.split('\n').map(line => line.trim()).join('\n');

        // Rimuovi righe vuote multiple
        text = text.replace(/\n{3,}/g, '\n\n');

        // Rimuovi spazi multipli
        text = text.replace(/[ \t]+/g, ' ');

        // Identifica e preserva sezioni comuni nei CV
        const sections = this.identifySections(text);
        if (sections.length > 0) {
            // Ricostruisci con sezioni identificate
            text = sections.map(section => {
                return `${section.title}\n${section.content}`;
            }).join('\n\n');
        }

        return text.trim();
    }

    /**
     * Identifica sezioni nel testo del CV
     * @private
     */
    identifySections(text) {
        const sections = [];
        const sectionKeywords = [
            'PROFILO', 'PROFILE', 'SOMMARIO', 'SUMMARY',
            'ESPERIENZA', 'EXPERIENCE', 'LAVORO', 'WORK',
            'FORMAZIONE', 'EDUCATION', 'STUDI', 'STUDY',
            'COMPETENZE', 'SKILLS', 'ABILITÀ', 'ABILITIES',
            'PROGETTI', 'PROJECTS', 'PORTFOLIO',
            'CERTIFICAZIONI', 'CERTIFICATIONS', 'CERTIFICATI',
            'LINGUE', 'LANGUAGES', 'IDIOMI',
            'RIFERIMENTI', 'REFERENCES', 'REFERENZE'
        ];

        const lines = text.split('\n');
        let currentSection = null;
        let currentContent = [];

        for (const line of lines) {
            const upperLine = line.toUpperCase();
            let isSection = false;

            // Verifica se la riga è un titolo di sezione
            for (const keyword of sectionKeywords) {
                if (upperLine.includes(keyword) && line.length < 50) {
                    isSection = true;

                    // Salva la sezione precedente
                    if (currentSection) {
                        sections.push({
                            title: currentSection,
                            content: currentContent.join('\n').trim()
                        });
                    }

                    // Inizia una nuova sezione
                    currentSection = line;
                    currentContent = [];
                    break;
                }
            }

            if (!isSection && currentSection) {
                currentContent.push(line);
            } else if (!isSection && !currentSection && line.trim()) {
                // Testo prima della prima sezione
                if (sections.length === 0) {
                    currentContent.push(line);
                }
            }
        }

        // Salva l'ultima sezione
        if (currentSection || currentContent.length > 0) {
            sections.push({
                title: currentSection || 'INFORMAZIONI GENERALI',
                content: currentContent.join('\n').trim()
            });
        }

        return sections;
    }

    /**
     * Calcola statistiche sul testo estratto
     * @private
     */
    calculateStatistics(text) {
        if (!text) return {};

        const words = text.split(/\s+/).filter(word => word.length > 0);
        const lines = text.split('\n').filter(line => line.trim().length > 0);

        return {
            characters: text.length,
            words: words.length,
            lines: lines.length,
            averageWordLength: words.length > 0
                ? Math.round(words.reduce((sum, word) => sum + word.length, 0) / words.length)
                : 0
        };
    }

    /**
     * Estrae testo da un file caricato via multipart/form-data
     * @param {Object} file - Oggetto file da multer
     * @returns {Object} Testo estratto
     */
    async extractFromUploadedFile(file) {
        try {
            // Determina l'estensione dal mimetype o dal nome originale
            let fileType;

            if (file.mimetype) {
                const mimeToExt = {
                    'application/pdf': 'pdf',
                    'application/msword': 'doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                    'text/plain': 'txt',
                    'application/rtf': 'rtf',
                    'text/rtf': 'rtf',
                    'application/vnd.oasis.opendocument.text': 'odt'
                };
                fileType = mimeToExt[file.mimetype];
            }

            if (!fileType && file.originalname) {
                const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
                if (this.supportedFormats[ext]) {
                    fileType = ext;
                }
            }

            if (!fileType) {
                throw new Error('Unable to determine file type');
            }

            // Estrai testo dal buffer
            const result = await this.extractText(file.buffer, fileType);

            // Aggiungi info del file uploadato
            if (result.success) {
                result.metadata = {
                    ...result.metadata,
                    originalName: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadDate: new Date().toISOString()
                };
            }

            return result;

        } catch (error) {
            console.error('Extraction from uploaded file failed:', error);
            throw error;
        }
    }
}

// Export singleton
module.exports = new DocumentParserService();