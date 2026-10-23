// The libft subject as data: prototypes, allowed functions, test drivers and
// hint ladders. Test drivers are plain C mains that use the __expect_*
// helpers built into the interpreter. Hints never contain C.

export const LIST_PRELUDE = "typedef struct s_list { void *content; struct s_list *next; } t_list;\n";

export const WALKTHROUGH = ["ft_isalpha", "ft_strlen", "ft_memset", "ft_memmove", "ft_strdup", "ft_split", "ft_lstnew"];

const W = "write", M = "malloc", F = "free";

export const CATALOG = {
  ft_isalpha: { part: 1, proto: "int ft_isalpha(int c);", allowed: [] },
  ft_isdigit: { part: 1, proto: "int ft_isdigit(int c);", allowed: [] },
  ft_isalnum: { part: 1, proto: "int ft_isalnum(int c);", allowed: [] },
  ft_isascii: { part: 1, proto: "int ft_isascii(int c);", allowed: [] },
  ft_isprint: { part: 1, proto: "int ft_isprint(int c);", allowed: [] },
  ft_strlen: { part: 1, proto: "size_t ft_strlen(const char *s);", allowed: [] },
  ft_memset: { part: 1, proto: "void *ft_memset(void *s, int c, size_t n);", allowed: [] },
  ft_bzero: { part: 1, proto: "void ft_bzero(void *s, size_t n);", allowed: [] },
  ft_memcpy: { part: 1, proto: "void *ft_memcpy(void *dst, const void *src, size_t n);", allowed: [] },
  ft_memmove: { part: 1, proto: "void *ft_memmove(void *dst, const void *src, size_t len);", allowed: [] },
  ft_strlcpy: { part: 1, proto: "size_t ft_strlcpy(char *dst, const char *src, size_t size);", allowed: [] },
  ft_strlcat: { part: 1, proto: "size_t ft_strlcat(char *dst, const char *src, size_t size);", allowed: [] },
  ft_toupper: { part: 1, proto: "int ft_toupper(int c);", allowed: [] },
  ft_tolower: { part: 1, proto: "int ft_tolower(int c);", allowed: [] },
  ft_strchr: { part: 1, proto: "char *ft_strchr(const char *s, int c);", allowed: [] },
  ft_strrchr: { part: 1, proto: "char *ft_strrchr(const char *s, int c);", allowed: [] },
  ft_strncmp: { part: 1, proto: "int ft_strncmp(const char *s1, const char *s2, size_t n);", allowed: [] },
  ft_memchr: { part: 1, proto: "void *ft_memchr(const void *s, int c, size_t n);", allowed: [] },
  ft_memcmp: { part: 1, proto: "int ft_memcmp(const void *s1, const void *s2, size_t n);", allowed: [] },
  ft_strnstr: { part: 1, proto: "char *ft_strnstr(const char *big, const char *little, size_t len);", allowed: [] },
  ft_atoi: { part: 1, proto: "int ft_atoi(const char *nptr);", allowed: [] },
  ft_calloc: { part: 1, proto: "void *ft_calloc(size_t nmemb, size_t size);", allowed: [M] },
  ft_strdup: { part: 1, proto: "char *ft_strdup(const char *s);", allowed: [M] },
  ft_substr: { part: 2, proto: "char *ft_substr(char const *s, unsigned int start, size_t len);", allowed: [M] },
  ft_strjoin: { part: 2, proto: "char *ft_strjoin(char const *s1, char const *s2);", allowed: [M] },
  ft_strtrim: { part: 2, proto: "char *ft_strtrim(char const *s1, char const *set);", allowed: [M] },
  ft_split: { part: 2, proto: "char **ft_split(char const *s, char c);", allowed: [M, F] },
  ft_itoa: { part: 2, proto: "char *ft_itoa(int n);", allowed: [M] },
  ft_strmapi: { part: 2, proto: "char *ft_strmapi(char const *s, char (*f)(unsigned int, char));", allowed: [M] },
  ft_striteri: { part: 2, proto: "void ft_striteri(char *s, void (*f)(unsigned int, char *));", allowed: [] },
  ft_putchar_fd: { part: 2, proto: "void ft_putchar_fd(char c, int fd);", allowed: [W] },
  ft_putstr_fd: { part: 2, proto: "void ft_putstr_fd(char *s, int fd);", allowed: [W] },
  ft_putendl_fd: { part: 2, proto: "void ft_putendl_fd(char *s, int fd);", allowed: [W] },
  ft_putnbr_fd: { part: 2, proto: "void ft_putnbr_fd(int n, int fd);", allowed: [W] },
  ft_lstnew: { part: 3, proto: "t_list *ft_lstnew(void *content);", allowed: [M] },
  ft_lstadd_front: { part: 3, proto: "void ft_lstadd_front(t_list **lst, t_list *new);", allowed: [] },
  ft_lstsize: { part: 3, proto: "int ft_lstsize(t_list *lst);", allowed: [] },
  ft_lstlast: { part: 3, proto: "t_list *ft_lstlast(t_list *lst);", allowed: [] },
  ft_lstadd_back: { part: 3, proto: "void ft_lstadd_back(t_list **lst, t_list *new);", allowed: [] },
  ft_lstdelone: { part: 3, proto: "void ft_lstdelone(t_list *lst, void (*del)(void *));", allowed: [F] },
  ft_lstclear: { part: 3, proto: "void ft_lstclear(t_list **lst, void (*del)(void *));", allowed: [F] },
  ft_lstiter: { part: 3, proto: "void ft_lstiter(t_list *lst, void (*f)(void *));", allowed: [] },
  ft_lstmap: { part: 3, proto: "t_list *ft_lstmap(t_list *lst, void *(*f)(void *), void (*del)(void *));", allowed: [M, F] },
};

const T = (name, body) => ({ name, code: `int\tmain(void)\n{\n${body.trim().split("\n").map((l) => "\t" + l.trim()).join("\n")}\n\treturn (0);\n}\n` });

const charTests = (fn, yes, no) => [
  T(`returns non-zero for ${yes.join(" ")}`, yes.map((c) => `__expect_bool(${fn}('${c}'), 1, "${fn}('${c}')");`).join("\n")),
  T("returns 0 for the neighbours", no.map((c) => `__expect_bool(${fn}(${c}), 0, "${fn}(${c})");`).join("\n")),
];

export const TESTS = {
  ft_isalpha: charTests("ft_isalpha", ["a", "z", "A", "Z", "m"], ["'@'", "'['", "'`'", "'{'", "'0'", "0", "200"]),
  ft_isdigit: charTests("ft_isdigit", ["0", "5", "9"], ["'/'", "':'", "'a'", "0"]),
  ft_isalnum: charTests("ft_isalnum", ["0", "9", "a", "Z"], ["'/'", "':'", "'@'", "'['", "' '"]),
  ft_isascii: [T("0 to 127 yes, others no", `__expect_bool(ft_isascii(0), 1, "ft_isascii(0)");\n__expect_bool(ft_isascii(127), 1, "ft_isascii(127)");\n__expect_bool(ft_isascii(128), 0, "ft_isascii(128)");\n__expect_bool(ft_isascii(-1), 0, "ft_isascii(-1)");`)],
  ft_isprint: [T("space to ~ only", `__expect_bool(ft_isprint(' '), 1, "ft_isprint(' ')");\n__expect_bool(ft_isprint('~'), 1, "ft_isprint('~')");\n__expect_bool(ft_isprint(31), 0, "ft_isprint(31)");\n__expect_bool(ft_isprint(127), 0, "ft_isprint(127)");`)],
  ft_toupper: [T("only changes a to z", `__expect_int(ft_toupper('a'), 'A', "ft_toupper('a')");\n__expect_int(ft_toupper('z'), 'Z', "ft_toupper('z')");\n__expect_int(ft_toupper('A'), 'A', "ft_toupper('A')");\n__expect_int(ft_toupper('{'), '{', "ft_toupper('{')");`)],
  ft_tolower: [T("only changes A to Z", `__expect_int(ft_tolower('A'), 'a', "ft_tolower('A')");\n__expect_int(ft_tolower('Z'), 'z', "ft_tolower('Z')");\n__expect_int(ft_tolower('a'), 'a', "ft_tolower('a')");\n__expect_int(ft_tolower('['), '[', "ft_tolower('[')");`)],
  ft_strlen: [
    T("empty string", `__expect_int(ft_strlen(""), 0, "ft_strlen(\\"\\")");`),
    T("short string", `__expect_int(ft_strlen("hi!"), 3, "ft_strlen(\\"hi!\\")");`),
    T("string with spaces and a newline", `__expect_int(ft_strlen("42 is\\nfun"), 9, "ft_strlen(\\"42 is\\\\nfun\\")");`),
  ],
  ft_memset: [
    T("fills the first n bytes", `char\tb[6] = "abcde";\nft_memset(b, 'x', 3);\n__expect_mem(b, "xxxde", 6, "after ft_memset(b, 'x', 3)");`),
    T("returns s", `char\tb[4] = "abc";\n__expect_ptr(ft_memset(b, 'z', 2), b, "return value");`),
    T("uses only the low byte of c", `char\tb[3] = "ab";\nft_memset(b, 0x141, 1);\n__expect_mem(b, "Ab", 3, "ft_memset(b, 0x141, 1)");`),
    T("n = 0 changes nothing", `char\tb[3] = "ab";\nft_memset(b, 'x', 0);\n__expect_mem(b, "ab", 3, "ft_memset(b, 'x', 0)");`),
  ],
  ft_bzero: [T("zeroes n bytes", `char\tb[4] = "abc";\nft_bzero(b, 2);\n__expect_mem(b, "\\0\\0c", 4, "after ft_bzero(b, 2)");`)],
  ft_memcpy: [
    T("copies n bytes", `char\td[6] = "-----";\nft_memcpy(d, "abc", 3);\n__expect_mem(d, "abc--", 6, "after ft_memcpy(d, \\"abc\\", 3)");`),
    T("returns dst", `char\td[4];\n__expect_ptr(ft_memcpy(d, "ab", 3), d, "return value");`),
  ],
  ft_memmove: [
    T("no overlap", `char\td[6] = "-----";\nft_memmove(d, "abc", 3);\n__expect_mem(d, "abc--", 6, "after ft_memmove(d, \\"abc\\", 3)");`),
    T("dst after src, overlapping", `char\tbuf[8] = "abcdef";\nft_memmove(buf + 2, buf, 4);\n__expect_mem(buf, "ababcd", 7, "after ft_memmove(buf + 2, buf, 4)");`),
    T("dst before src, overlapping", `char\tbuf[8] = "abcdef";\nft_memmove(buf, buf + 2, 4);\n__expect_mem(buf, "cdefef", 7, "after ft_memmove(buf, buf + 2, 4)");`),
    T("len = 0 and return value", `char\tbuf[4] = "abc";\n__expect_ptr(ft_memmove(buf, buf + 1, 0), buf, "return value");\n__expect_mem(buf, "abc", 4, "buffer after len = 0");`),
  ],
  ft_strlcpy: [
    T("fits", `char\td[8];\n__expect_int(ft_strlcpy(d, "abc", 8), 3, "return value");\n__expect_str(d, "abc", "dst");`),
    T("truncates and terminates", `char\td[4];\n__expect_int(ft_strlcpy(d, "abcdef", 4), 6, "return value");\n__expect_str(d, "abc", "dst");`),
    T("size = 0 writes nothing", `char\td[2] = "x";\n__expect_int(ft_strlcpy(d, "abc", 0), 3, "return value");\n__expect_str(d, "x", "dst");`),
  ],
  ft_strlcat: [
    T("appends", `char\td[10] = "ab";\n__expect_int(ft_strlcat(d, "cd", 10), 4, "return value");\n__expect_str(d, "abcd", "dst");`),
    T("truncates", `char\td[5] = "ab";\n__expect_int(ft_strlcat(d, "cdef", 5), 6, "return value");\n__expect_str(d, "abcd", "dst");`),
    T("size smaller than dst length", `char\td[8] = "abcd";\n__expect_int(ft_strlcat(d, "xy", 2), 4, "return value");\n__expect_str(d, "abcd", "dst");`),
  ],
  ft_strchr: [
    T("finds the first match", `char\t*s = "banana";\n__expect_ptr(ft_strchr(s, 'n'), s + 2, "ft_strchr(\\"banana\\", 'n')");`),
    T("finds the terminator", `char\t*s = "abc";\n__expect_ptr(ft_strchr(s, '\\0'), s + 3, "ft_strchr(s, '\\\\0')");`),
    T("returns NULL when missing", `__expect_ptr(ft_strchr("abc", 'z'), 0, "ft_strchr(\\"abc\\", 'z')");`),
  ],
  ft_strrchr: [
    T("finds the last match", `char\t*s = "banana";\n__expect_ptr(ft_strrchr(s, 'a'), s + 5, "ft_strrchr(\\"banana\\", 'a')");`),
    T("returns NULL when missing", `__expect_ptr(ft_strrchr("abc", 'z'), 0, "ft_strrchr(\\"abc\\", 'z')");`),
  ],
  ft_strncmp: [
    T("equal prefixes", `__expect_sign(ft_strncmp("abcx", "abcy", 3), 0, "ft_strncmp(\\"abcx\\", \\"abcy\\", 3)");`),
    T("first difference decides", `__expect_sign(ft_strncmp("abd", "abc", 3), 1, "ft_strncmp(\\"abd\\", \\"abc\\", 3)");\n__expect_sign(ft_strncmp("ab", "abc", 3), -1, "ft_strncmp(\\"ab\\", \\"abc\\", 3)");`),
    T("compares as unsigned char", `__expect_sign(ft_strncmp("\\x80", "a", 1), 1, "ft_strncmp(\\"\\\\x80\\", \\"a\\", 1)");`),
    T("n = 0", `__expect_int(ft_strncmp("a", "b", 0), 0, "ft_strncmp(\\"a\\", \\"b\\", 0)");`),
  ],
  ft_atoi: [
    T("plain numbers", `__expect_int(ft_atoi("42"), 42, "ft_atoi(\\"42\\")");\n__expect_int(ft_atoi("-17"), -17, "ft_atoi(\\"-17\\")");`),
    T("leading spaces and one sign", `__expect_int(ft_atoi(" \\t\\n+5x"), 5, "ft_atoi(\\" \\\\t\\\\n+5x\\")");\n__expect_int(ft_atoi("--5"), 0, "ft_atoi(\\"--5\\")");`),
    T("INT_MIN and INT_MAX", `__expect_int(ft_atoi("-2147483648"), -2147483648, "ft_atoi(\\"-2147483648\\")");\n__expect_int(ft_atoi("2147483647"), 2147483647, "ft_atoi(\\"2147483647\\")");`),
  ],
  ft_calloc: [
    T("zeroed memory", `char\t*p;\n\np = ft_calloc(4, 1);\n__expect_mem(p, "\\0\\0\\0\\0", 4, "ft_calloc(4, 1)");\nfree(p);`),
  ],
  ft_strdup: [
    T("copies the string", `char\t*c;\n\nc = ft_strdup("42!");\n__expect_str(c, "42!", "ft_strdup(\\"42!\\")");\nfree(c);`),
    T("empty string", `char\t*c;\n\nc = ft_strdup("");\n__expect_str(c, "", "ft_strdup(\\"\\")");\nfree(c);`),
    T("the copy is independent", `char\ts[4] = "abc";\nchar\t*c;\n\nc = ft_strdup(s);\nc[0] = 'X';\n__expect_str(s, "abc", "original after changing the copy");\nfree(c);`),
  ],
  ft_substr: [
    T("middle of the string", `char\t*r;\n\nr = ft_substr("hello", 1, 3);\n__expect_str(r, "ell", "ft_substr(\\"hello\\", 1, 3)");\nfree(r);`),
    T("start past the end", `char\t*r;\n\nr = ft_substr("hi", 5, 3);\n__expect_str(r, "", "ft_substr(\\"hi\\", 5, 3)");\nfree(r);`),
    T("len longer than what is left", `char\t*r;\n\nr = ft_substr("hello", 3, 100);\n__expect_str(r, "lo", "ft_substr(\\"hello\\", 3, 100)");\nfree(r);`),
  ],
  ft_strjoin: [T("joins two strings", `char\t*r;\n\nr = ft_strjoin("ab", "cd");\n__expect_str(r, "abcd", "ft_strjoin(\\"ab\\", \\"cd\\")");\nfree(r);`)],
  ft_strtrim: [
    T("trims both ends", `char\t*r;\n\nr = ft_strtrim("xxhixx", "x");\n__expect_str(r, "hi", "ft_strtrim(\\"xxhixx\\", \\"x\\")");\nfree(r);`),
    T("everything trimmed", `char\t*r;\n\nr = ft_strtrim("aaa", "a");\n__expect_str(r, "", "ft_strtrim(\\"aaa\\", \\"a\\")");\nfree(r);`),
  ],
  ft_split: [
    T("several words", `char\t**w;\nint\t\ti;\n\nw = ft_split("  ab cd e", ' ');\n__expect_str(w[0], "ab", "w[0]");\n__expect_str(w[1], "cd", "w[1]");\n__expect_str(w[2], "e", "w[2]");\n__expect_ptr(w[3], 0, "w[3]");\ni = 0;\nwhile (w[i])\nfree(w[i++]);\nfree(w);`),
    T("empty string", `char\t**w;\n\nw = ft_split("", ' ');\n__expect_ptr(w[0], 0, "w[0]");\nfree(w);`),
    T("only separators", `char\t**w;\n\nw = ft_split("xxx", 'x');\n__expect_ptr(w[0], 0, "w[0]");\nfree(w);`),
  ],
  ft_itoa: [
    T("positive, negative, zero", `char\t*r;\n\nr = ft_itoa(42);\n__expect_str(r, "42", "ft_itoa(42)");\nfree(r);\nr = ft_itoa(-7);\n__expect_str(r, "-7", "ft_itoa(-7)");\nfree(r);\nr = ft_itoa(0);\n__expect_str(r, "0", "ft_itoa(0)");\nfree(r);`),
    T("INT_MIN", `char\t*r;\n\nr = ft_itoa(-2147483648);\n__expect_str(r, "-2147483648", "ft_itoa(INT_MIN)");\nfree(r);`),
  ],
  ft_putchar_fd: [T("writes one char", `ft_putchar_fd('A', 1);\n__expect_out("A", "output");`)],
  ft_putstr_fd: [T("writes the string", `ft_putstr_fd("hello", 1);\n__expect_out("hello", "output");`)],
  ft_putendl_fd: [T("adds a newline", `ft_putendl_fd("hi", 1);\n__expect_out("hi\\n", "output");`)],
  ft_putnbr_fd: [
    T("prints numbers", `ft_putnbr_fd(42, 1);\n__expect_out("42", "ft_putnbr_fd(42)");\nft_putnbr_fd(-7, 1);\n__expect_out("-7", "ft_putnbr_fd(-7)");\nft_putnbr_fd(0, 1);\n__expect_out("0", "ft_putnbr_fd(0)");`),
    T("INT_MIN", `ft_putnbr_fd(-2147483648, 1);\n__expect_out("-2147483648", "ft_putnbr_fd(INT_MIN)");`),
  ],
  ft_lstnew: [
    T("sets content and next", `t_list\t*n;\nchar\t*s = "data";\n\nn = ft_lstnew(s);\n__expect_ptr(n->content, s, "n->content");\n__expect_ptr(n->next, 0, "n->next");\nfree(n);`),
  ],
  ft_lstsize: [
    T("counts nodes", `t_list\ta;\nt_list\tb;\n\na.next = &b;\nb.next = 0;\n__expect_int(ft_lstsize(&a), 2, "ft_lstsize(a -> b)");\n__expect_int(ft_lstsize(0), 0, "ft_lstsize(NULL)");`),
  ],
  ft_lstlast: [
    T("finds the last node", `t_list\ta;\nt_list\tb;\n\na.next = &b;\nb.next = 0;\n__expect_ptr(ft_lstlast(&a), &b, "ft_lstlast(a -> b)");\n__expect_ptr(ft_lstlast(0), 0, "ft_lstlast(NULL)");`),
  ],
  ft_lstadd_front: [
    T("new node becomes the head", `t_list\ta;\nt_list\tn;\nt_list\t*head;\n\na.next = 0;\nhead = &a;\nft_lstadd_front(&head, &n);\n__expect_ptr(head, &n, "head");\n__expect_ptr(n.next, &a, "n.next");`),
  ],
  ft_lstadd_back: [
    T("appends at the end", `t_list\ta;\nt_list\tn;\nt_list\t*head;\n\na.next = 0;\nn.next = 0;\nhead = &a;\nft_lstadd_back(&head, &n);\n__expect_ptr(a.next, &n, "a.next");`),
    T("empty list", `t_list\tn;\nt_list\t*head;\n\nn.next = 0;\nhead = 0;\nft_lstadd_back(&head, &n);\n__expect_ptr(head, &n, "head");`),
  ],
};

// Milestones and three-level hints: question, concept, plain-language next step.
export const GUIDE = {
  ft_isalpha: [
    { t: "Match the prototype", d: "It takes an int and returns an int, like the real isalpha." },
    { t: "Describe a letter as ranges", d: "Letters are two runs of consecutive codes.",
      hints: ["Look at an ASCII table. Where do the lowercase letters start and end? And the uppercase ones?",
        "Characters are just numbers. 'a' to 'z' are consecutive, and so are 'A' to 'Z'. The characters between 'Z' and 'a' are not letters.",
        "Return true when c is inside the uppercase range or inside the lowercase range. Return 0 for everything else."] },
    { t: "Check the boundaries", d: "'@', '[', '`' and '{' sit just outside the ranges.",
      hints: ["Which characters come right before 'A' and right after 'z'? Does your function reject them?",
        "Off-by-one mistakes happen at the edges of a range. Inclusive comparisons keep both ends inside.",
        "Test your condition with the four neighbour characters by hand before running."] },
  ],
  ft_strlen: [
    { t: "Match the prototype", d: "const char * in, size_t out." },
    { t: "Pick what you count with", d: "One variable can be both the counter and the index.",
      hints: ["What has to change each time you look at the next character?",
        "An index starts at the first character and moves one position at a time. Its final value can also be the answer.",
        "Start a counter at zero and move forward one character per loop pass."] },
    { t: "Stop at the terminator", d: "The loop ends on '\\0', not before and not after.",
      hints: ["In the memory pane, what is stored in the last cell of every string?",
        "C strings have no stored length. The only way to know where one ends is the '\\0' byte.",
        "Keep going while the current character is not the terminator, then return how far you got."] },
  ],
  ft_memset: [
    { t: "Match the prototype", d: "void * in, void * out, int value, size_t count." },
    { t: "Write bytes, not ints", d: "You cannot index a void pointer.",
      hints: ["What happens when you try to index s directly? What size would each step be?",
        "void * has no element size. To touch single bytes, view the memory through a pointer to unsigned char.",
        "Make a byte pointer to s, then set n bytes one by one to c converted to unsigned char."] },
    { t: "Return the original pointer", d: "The caller gets s back, not where you stopped.",
      hints: ["After your loop, where does your byte pointer point? Is that what the subject asks you to return?",
        "If you move the pointer itself, you lose the start address. An index keeps the start intact.",
        "Return s itself at the end."] },
  ],
  ft_memmove: [
    { t: "Match the prototype", d: "void pointers in, void pointer out." },
    { t: "Copy bytes one at a time", d: "Cast to unsigned char so each step moves exactly one byte." },
    { t: "Survive overlapping memory", d: "The overlap test fails when dst starts inside src.",
      hints: ["Run the overlap test and step to the third copy. Which byte did you read, and when was it last written?",
        "When dst starts after src in the same buffer, copying from the front overwrites source bytes before you get to read them. The direction of the copy decides which bytes are still safe to read.",
        "Before copying, compare the two addresses. If dst comes after src, walk from the last byte down to the first. Otherwise walk forward."] },
    { t: "Cover the edge cases", d: "len of 0, dst equal to src, both pointers NULL." },
  ],
  ft_strdup: [
    { t: "Match the prototype", d: "Takes a const string, returns a new one." },
    { t: "Allocate the right size", d: "Every byte of the copy must fit in your block.",
      hints: ["Count the cells of the string literal in the memory pane. How many bytes does it really occupy?",
        "strlen counts the characters before the terminator. A C string needs one extra byte to hold '\\0', and malloc gives exactly what you ask for, never more.",
        "Ask malloc for the length of s plus room for the terminator. Check the result for NULL before using it."] },
    { t: "Copy, then terminate", d: "The copy must end with its own '\\0'." },
  ],
  ft_split: [
    { t: "Count the words first", d: "You need the size of the outer array before filling it.",
      hints: ["For \"  ab cd e\" and ' ', how many words are there? How did you know where each one starts?",
        "A word starts where a non-separator follows a separator, or at the start of the string. Counting those starts gives the word count.",
        "Walk the string once and count word starts. Allocate that many pointers plus one for the final NULL."] },
    { t: "Allocate each word", d: "Each word gets its own block, including its '\\0'." },
    { t: "Free everything on failure", d: "If one malloc fails, free the words you already made.",
      hints: ["If the third malloc returns NULL, which blocks are still allocated?",
        "Every successful malloc must be matched by a free on every path, including the error path.",
        "When an allocation fails, free the words made so far, then the outer array, and return NULL."] },
  ],
  ft_lstnew: [
    { t: "Allocate one node", d: "sizeof the struct, not of a pointer to it.",
      hints: ["In the memory pane, how many bytes does one t_list take? How many does a pointer take?",
        "sizeof(t_list *) is the size of an address. You need room for the whole struct: content and next.",
        "Ask malloc for the size of one t_list and check the result."] },
    { t: "Fill both fields", d: "content from the argument, next set to NULL." },
  ],
};
