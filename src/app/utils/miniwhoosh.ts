type Tokenizer = {
    tokenize: (value: string) => Set<string>;
};

export type MiniwhooshDocument = {
    id: string;
    content: Record<string, string>;
};

export type SchemaFields = Record<string, Record<string, Set<string>>>;

class RegexTokenizer implements Tokenizer {
    private pattern = /[\w\*]+(\.?[\w\*]+)*/g;
    private stopwords = new Set<string>([
        "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
        "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
        "she", "her", "hers", "herself", "it", "its", "itself", "they", "them",
        "their", "theirs", "themselves", "what", "which", "who", "whom", "this",
        "that", "these", "those", "am", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "having", "do", "does", "did", "doing",
        "a", "an", "the", "and", "but", "if", "or", "because", "as", "until",
        "while", "of", "at", "by", "for", "with", "about", "against", "between",
        "into", "through", "during", "before", "after", "above", "below", "to",
        "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
        "further", "then", "once", "here", "there", "when", "where", "why", "how",
        "all", "any", "both", "each", "few", "more", "most", "other", "some", 
        "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", 
        "very", "can", "will", "just", "don", "should", "now"
    ]);

    tokenize(value: string): Set<string> {
        const tokens = new Set<string>();
        for (const match of value.toLowerCase().matchAll(this.pattern)) {
            const token = match[0];
            if (!this.stopwords.has(token)) tokens.add(token);
        }
        return tokens;
    }
}

class NopTokenizer implements Tokenizer {
    tokenize(value: string): Set<string> {
        return new Set([value]);
    }
}

type Field = {
    tokenizer: Tokenizer;
};

const TEXT_FIELD: Field = { tokenizer: new RegexTokenizer() };
const KEYWORD_FIELD: Field = { tokenizer: new RegexTokenizer() };
const BOOLEAN_FIELD: Field = { tokenizer: new NopTokenizer() };
const NUMERIC_FIELD: Field = { tokenizer: new NopTokenizer() };

export const schema = {
    id: NUMERIC_FIELD,
    title: TEXT_FIELD,
    content: TEXT_FIELD,
    asn: NUMERIC_FIELD,
    correspondent: TEXT_FIELD,
    correspondent_id: NUMERIC_FIELD,
    has_correspondent: BOOLEAN_FIELD,
    tag: KEYWORD_FIELD,
    tag_id: KEYWORD_FIELD,
    has_tag: BOOLEAN_FIELD,
    type: TEXT_FIELD,
    type_id: NUMERIC_FIELD,
    has_type: BOOLEAN_FIELD,
    created: NUMERIC_FIELD,
    modified: NUMERIC_FIELD,
    added: NUMERIC_FIELD,
    path: TEXT_FIELD,
    path_id: NUMERIC_FIELD,
    has_path: BOOLEAN_FIELD,
    notes: TEXT_FIELD,
    num_notes: NUMERIC_FIELD,
    custom_fields: TEXT_FIELD,
    custom_field_count: NUMERIC_FIELD,
    has_custom_fields: BOOLEAN_FIELD,
    custom_fields_id: KEYWORD_FIELD,
    owner: TEXT_FIELD,
    owner_id: NUMERIC_FIELD,
    has_owner: BOOLEAN_FIELD,
    viewer_id: KEYWORD_FIELD,
    checksum: TEXT_FIELD,
    page_count: NUMERIC_FIELD,
    original_filename: TEXT_FIELD,
    is_shared: BOOLEAN_FIELD
};
