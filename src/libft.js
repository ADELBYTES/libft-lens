// The libft subject as data: prototypes, allowed functions, test drivers and
// hint ladders. Test drivers are plain C mains that use the __expect_*
// helpers built into the interpreter. Hints never contain C.

export const LIST_PRELUDE = "typedef struct s_list { void *content; struct s_list *next; } t_list;\n";

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
  ft_lstsize: { part: 3, proto: "unsigned int ft_lstsize(t_list *lst);", allowed: [] },
  ft_lstlast: { part: 3, proto: "t_list *ft_lstlast(t_list *lst);", allowed: [] },
  ft_lstadd_back: { part: 3, proto: "void ft_lstadd_back(t_list **lst, t_list *new);", allowed: [] },
  ft_lstdelone: { part: 3, proto: "void ft_lstdelone(t_list *lst, void (*del)(void *));", allowed: [F] },
  ft_lstclear: { part: 3, proto: "void ft_lstclear(t_list **lst, void (*del)(void *));", allowed: [F] },
  ft_lstiter: { part: 3, proto: "void ft_lstiter(t_list *lst, void (*f)(void *));", allowed: [] },
  ft_lstmap: { part: 3, proto: "t_list *ft_lstmap(t_list *lst, void *(*f)(void *), void (*del)(void *));", allowed: [M, F] },
};

// a test driver: optional helper code, then a main running the checks
const T = (name, body, pre = "") => ({ name, code: `${pre ? pre.trim() + "\n\n" : ""}int\tmain(void)\n{\n${body.trim().split("\n").map((l) => "\t" + l.trim()).join("\n")}\n\treturn (0);\n}\n` });

const charTests = (fn, yes, no) => [
  T(`returns 1 for ${yes.join(" ")}`, yes.map((c) => `__expect_int(${fn}('${c}'), 1, "${fn}('${c}')");`).join("\n")),
  T("returns 0 for the neighbours", no.map((c) => `__expect_int(${fn}(${c}), 0, "${fn}(${c})");`).join("\n")),
];

export const TESTS = {
  ft_isalpha: charTests("ft_isalpha", ["a", "z", "A", "Z", "m"], ["'@'", "'['", "'`'", "'{'", "'0'", "0", "200"]),
  ft_isdigit: charTests("ft_isdigit", ["0", "5", "9"], ["'/'", "':'", "'a'", "0"]),
  ft_isalnum: charTests("ft_isalnum", ["0", "9", "a", "Z"], ["'/'", "':'", "'@'", "'['", "' '"]),
  ft_isascii: [T("0 to 127 yes, others no", `__expect_int(ft_isascii(0), 1, "ft_isascii(0)");\n__expect_int(ft_isascii(127), 1, "ft_isascii(127)");\n__expect_int(ft_isascii(128), 0, "ft_isascii(128)");\n__expect_int(ft_isascii(-1), 0, "ft_isascii(-1)");`)],
  ft_isprint: [T("space to ~ only", `__expect_int(ft_isprint(' '), 1, "ft_isprint(' ')");\n__expect_int(ft_isprint('~'), 1, "ft_isprint('~')");\n__expect_int(ft_isprint(31), 0, "ft_isprint(31)");\n__expect_int(ft_isprint(127), 0, "ft_isprint(127)");`)],
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
  ft_memchr: [
    T("finds a byte", `char\tb[6] = "a\\0bcd";\n__expect_ptr(ft_memchr(b, 'c', 5), b + 3, "ft_memchr(b, 'c', 5)");`),
    T("does not stop at '\\\\0'", `char\tb[4] = "a\\0b";\n__expect_ptr(ft_memchr(b, 'b', 3), b + 2, "ft_memchr(\\"a\\\\0b\\", 'b', 3)");`),
    T("stays within n", `char\tb[4] = "abc";\n__expect_ptr(ft_memchr(b, 'c', 2), 0, "ft_memchr(b, 'c', 2)");`),
  ],
  ft_memcmp: [
    T("equal buffers", `__expect_int(ft_memcmp("abc", "abc", 3), 0, "ft_memcmp(\\"abc\\", \\"abc\\", 3)");`),
    T("first difference decides", `__expect_sign(ft_memcmp("abd", "abc", 3), 1, "ft_memcmp(\\"abd\\", \\"abc\\", 3)");\n__expect_sign(ft_memcmp("a\\x80", "a\\x01", 2), 1, "ft_memcmp(\\"a\\\\x80\\", \\"a\\\\x01\\", 2)");`),
    T("keeps going past '\\\\0'", `char\ta[3] = "a\\0b";\nchar\tb[3] = "a\\0c";\n__expect_sign(ft_memcmp(a, b, 3), -1, "ft_memcmp(\\"a\\\\0b\\", \\"a\\\\0c\\", 3)");`),
  ],
  ft_strnstr: [
    T("finds inside len", `char\t*s = "lorem ipsum";\n__expect_ptr(ft_strnstr(s, "ips", 11), s + 6, "ft_strnstr(s, \\"ips\\", 11)");`),
    T("match crosses len", `__expect_ptr(ft_strnstr("lorem ipsum", "ips", 7), 0, "ft_strnstr(s, \\"ips\\", 7)");`),
    T("empty little", `char\t*s = "abc";\n__expect_ptr(ft_strnstr(s, "", 2), s, "ft_strnstr(s, \\"\\", 2)");`),
  ],
  ft_strmapi: [
    T("applies f with the index", `char\t*r;\n\nr = ft_strmapi("abcd", up_odd);\n__expect_str(r, "aBcD", "ft_strmapi(\\"abcd\\", up_odd)");\nfree(r);`,
      "static char\tup_odd(unsigned int i, char c)\n{\n\tif (i % 2)\n\t\treturn (c - 32);\n\treturn (c);\n}"),
  ],
  ft_striteri: [
    T("changes characters in place", `char\ts[4] = "abc";\n\nft_striteri(s, upper_first);\n__expect_str(s, "Abc", "s after ft_striteri");`,
      "static void\tupper_first(unsigned int i, char *c)\n{\n\tif (i == 0)\n\t\t*c = *c - 32;\n}"),
  ],
  ft_lstdelone: [
    T("frees content and node", `t_list\t*n;\n\nn = malloc(sizeof(t_list));\nn->content = malloc(4);\nn->next = 0;\nft_lstdelone(n, del_content);\n__expect_int(1, 1, "ft_lstdelone returned; the leak check confirms both blocks were freed");`,
      "static void\tdel_content(void *p)\n{\n\tfree(p);\n}"),
  ],
  ft_lstclear: [
    T("frees every node and sets the head to NULL", `t_list\t*head;\nt_list\t*n;\nint\t\ti;\n\nhead = 0;\ni = 0;\nwhile (i < 3)\n{\nn = malloc(sizeof(t_list));\nn->content = malloc(2);\nn->next = head;\nhead = n;\ni++;\n}\nft_lstclear(&head, del_content);\n__expect_ptr(head, 0, "head after ft_lstclear");`,
      "static void\tdel_content(void *p)\n{\n\tfree(p);\n}"),
  ],
  ft_lstiter: [
    T("calls f on each content", `int\t\tv[2] = {1, 5};\nt_list\ta;\nt_list\tb;\n\na.content = &v[0];\na.next = &b;\nb.content = &v[1];\nb.next = 0;\nft_lstiter(&a, bump);\n__expect_int(v[0], 2, "first content");\n__expect_int(v[1], 6, "second content");`,
      "static void\tbump(void *p)\n{\n\t*(int *)p += 1;\n}"),
  ],
  ft_lstmap: [
    T("builds a new list", `t_list\ta;\nt_list\tb;\nt_list\t*r;\nt_list\t*next;\n\na.content = "ab";\na.next = &b;\nb.content = "cd";\nb.next = 0;\nr = ft_lstmap(&a, dup_upper, free_content);\n__expect_str(r->content, "Ab", "first content");\n__expect_str(r->next->content, "Cd", "second content");\n__expect_ptr(r->next->next, 0, "end of the new list");\n__expect_str(a.content, "ab", "original list unchanged");\nwhile (r)\n{\nnext = r->next;\nfree(r->content);\nfree(r);\nr = next;\n}`,
      "static void\t*dup_upper(void *p)\n{\n\tchar\t*s;\n\n\ts = strdup(p);\n\ts[0] = s[0] - 32;\n\treturn (s);\n}\n\nstatic void\tfree_content(void *p)\n{\n\tfree(p);\n}"),
  ],
};

// calloc rules from the subject: a size of 0 still gives a pointer free() accepts
TESTS.ft_calloc.push(
  T("zero size gives a freeable pointer", `void\t*p;\n\np = ft_calloc(0, 4);\n__expect_bool(p != 0, 1, "ft_calloc(0, 4) is not NULL");\nfree(p);`),
  T("refuses an overflowing size", `__expect_ptr(ft_calloc(SIZE_MAX, 2), 0, "ft_calloc(SIZE_MAX, 2)");`),
);

// "NULL if the allocation fails", and no leaks on the way out: the n-th malloc
// from the call returns NULL, and the leak check catches anything not freed
const failing = (fn, call, n = 1, pre = "") => T(`returns NULL when malloc fails`, `__fail_malloc_after(${n});\n__expect_ptr(${call}, 0, "${call.replace(/"/g, '\\"')} with malloc failing");`, pre);
TESTS.ft_calloc.push(failing("ft_calloc", "ft_calloc(4, 4)"));
TESTS.ft_strdup.push(failing("ft_strdup", 'ft_strdup("abc")'));
TESTS.ft_substr.push(failing("ft_substr", 'ft_substr("hello", 1, 3)'));
TESTS.ft_strjoin.push(failing("ft_strjoin", 'ft_strjoin("ab", "cd")'));
TESTS.ft_strtrim.push(failing("ft_strtrim", 'ft_strtrim("xxhixx", "x")'));
TESTS.ft_itoa.push(failing("ft_itoa", "ft_itoa(42)"));
TESTS.ft_strmapi.push(failing("ft_strmapi", 'ft_strmapi("abc", same)', 1, "static char\tsame(unsigned int i, char c)\n{\n\t(void)i;\n\treturn (c);\n}"));
TESTS.ft_lstnew.push(failing("ft_lstnew", 'ft_lstnew("x")'));
TESTS.ft_split.push(T("frees everything when a malloc fails", `__fail_malloc_after(3);\n__expect_ptr(ft_split("ab cd ef", ' '), 0, "ft_split when its 3rd malloc fails");`));
TESTS.ft_lstmap.push(T("cleans up when a node cannot be made", `t_list\ta;\nt_list\tb;\n\na.content = "ab";\na.next = &b;\nb.content = "cd";\nb.next = 0;\n__fail_malloc_after(2);\n__expect_ptr(ft_lstmap(&a, dup_upper, free_content), 0, "ft_lstmap when the 2nd node fails");`,
  "static void\t*dup_upper(void *p)\n{\n\tchar\t*s;\n\n\ts = strdup(p);\n\ts[0] = s[0] - 32;\n\treturn (s);\n}\n\nstatic void\tfree_content(void *p)\n{\n\tfree(p);\n}"));
