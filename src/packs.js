// The ft_printf (subject v12.1) and get_next_line (subject v14.3) packs.
// Each project is split into small steps. The helper names (pf_*, gnl_*)
// are one sensible way to split the work; only ft_printf and get_next_line
// themselves are fixed by the subjects. Same solution format as exercises.js.

// a test driver: optional helper code, then a main; `defines` acts like cc -D
const T = (name, body, pre = "", extra = {}) => ({
  name, ...extra,
  code: `${pre ? pre.trim() + "\n\n" : ""}int\tmain(void)\n{\n${body.trim().split("\n").map((l) => "\t" + l.trim()).join("\n")}\n\treturn (0);\n}\n`,
});
const c = (s) => JSON.stringify(s); // a JS string as a C string literal
const P = (call, fmt, ...args) => `__expect_printf(${call}, ${c(fmt)}${args.map((a) => ", " + a).join("")});`;

export const PACK_RULES = {
  libft: { libft: true, staticHelpers: true, noGlobals: true, helperAllowed: ["malloc", "free", "write"] },
  ft_printf: { libft: true, staticHelpers: false, noGlobals: false, helperAllowed: ["malloc", "free", "write"] },
  get_next_line: { libft: false, staticHelpers: false, noGlobals: true, helperAllowed: ["read", "malloc", "free"] },
};

export const PACK_PARTS = { pf: "ft_printf", gnl: "get_next_line" };

export const CATALOG_MORE = {
  pf_putchar: { part: "pf", pack: "ft_printf", proto: "int pf_putchar(int c);", allowed: ["write"] },
  pf_putstr: { part: "pf", pack: "ft_printf", proto: "int pf_putstr(char *s);", allowed: ["write"] },
  pf_putnbr: { part: "pf", pack: "ft_printf", proto: "int pf_putnbr(int n);", allowed: ["write"] },
  pf_putnbr_base: { part: "pf", pack: "ft_printf", proto: "int pf_putnbr_base(unsigned long n, const char *base);", allowed: ["write"] },
  pf_putptr: { part: "pf", pack: "ft_printf", proto: "int pf_putptr(void *p);", allowed: ["write"] },
  ft_printf: { part: "pf", pack: "ft_printf", proto: "int ft_printf(const char *format, ...);", allowed: ["malloc", "free", "write"] },
  gnl_strlen: { part: "gnl", pack: "get_next_line", proto: "size_t gnl_strlen(const char *s);", allowed: [] },
  gnl_strchr: { part: "gnl", pack: "get_next_line", proto: "char *gnl_strchr(const char *s, int c);", allowed: [] },
  gnl_strjoin: { part: "gnl", pack: "get_next_line", proto: "char *gnl_strjoin(char *stash, const char *buf);", allowed: ["malloc", "free"] },
  gnl_get_line: { part: "gnl", pack: "get_next_line", proto: "char *gnl_get_line(const char *stash);", allowed: ["malloc"] },
  gnl_rest: { part: "gnl", pack: "get_next_line", proto: "char *gnl_rest(char *stash);", allowed: ["malloc", "free"] },
  get_next_line: { part: "gnl", pack: "get_next_line", proto: "char *get_next_line(int fd);", allowed: ["read", "malloc", "free"] },
};

export const ORDERS = {
  ft_printf: ["pf_putchar", "pf_putstr", "pf_putnbr", "pf_putnbr_base", "pf_putptr", "ft_printf"],
  get_next_line: ["gnl_strlen", "gnl_strchr", "gnl_strjoin", "gnl_get_line", "gnl_rest", "get_next_line"],
};

/* ---------------- tests ---------------- */

// reads a whole file line by line and checks each line, then the final NULL
function gnlFile(name, content, lines, bs, extra = {}) {
  let body = `int\t\tfd;\nchar\t*l;\n\n__mkfile("t.txt", ${c(content)});\nfd = open("t.txt", O_RDONLY);\n`;
  lines.forEach((ln, k) => { body += `l = get_next_line(fd);\n__expect_str(l, ${c(ln)}, "line ${k + 1}");\nfree(l);\n`; });
  body += `__expect_ptr(get_next_line(fd), 0, "after the last line");\nclose(fd);`;
  return T(`${name} (BUFFER_SIZE=${bs})`, body, "", { defines: { BUFFER_SIZE: String(bs) }, ...extra });
}

export const TESTS_MORE = {
  pf_putchar: [
    T("prints one character and returns 1", P("pf_putchar('A')", "A")),
    T("prints a newline", P("pf_putchar('\\n')", "\n")),
  ],
  pf_putstr: [
    T("prints a string and returns its length", P('pf_putstr("hello")', "hello")),
    T("NULL prints (null)", P("pf_putstr(NULL)", "(null)")),
    T("empty string returns 0", P('pf_putstr("")', "")),
  ],
  pf_putnbr: [
    T("zero, positive, negative", [P("pf_putnbr(0)", "%d", "0"), P("pf_putnbr(42)", "%d", "42"), P("pf_putnbr(-42)", "%d", "-42")].join("\n")),
    T("INT_MIN and INT_MAX", [P("pf_putnbr(INT_MIN)", "%d", "INT_MIN"), P("pf_putnbr(INT_MAX)", "%d", "INT_MAX")].join("\n")),
  ],
  pf_putnbr_base: [
    T("decimal", [P('pf_putnbr_base(0, "0123456789")', "%u", "0"), P('pf_putnbr_base(4294967295U, "0123456789")', "%u", "4294967295U"), P('pf_putnbr_base(18446744073709551615UL, "0123456789")', "%lu", "18446744073709551615UL")].join("\n")),
    T("hexadecimal", [P('pf_putnbr_base(255, "0123456789abcdef")', "%x", "255"), P('pf_putnbr_base(3054, "0123456789ABCDEF")', "%X", "3054")].join("\n")),
  ],
  pf_putptr: [
    T("prints an address", `int\tx;\n\n${P("pf_putptr(&x)", "%p", "&x")}`),
    T("NULL pointer", P("pf_putptr(NULL)", "%p", "NULL")),
  ],
  ft_printf: [
    T("plain text and %%", [P('ft_printf("hello, 42!")', "hello, 42!"), P('ft_printf("100%%")', "100%%")].join("\n")),
    T("%c and %s", [P('ft_printf("[%c] [%s]", \'z\', "abc")', "[%c] [%s]", "'z'", '"abc"'), P('ft_printf("%s", NULL)', "%s", "NULL")].join("\n")),
    T("%d and %i", [P('ft_printf("%d %i %d", 0, -42, INT_MIN)', "%d %i %d", "0", "-42", "INT_MIN"), P('ft_printf("%d", INT_MAX)', "%d", "INT_MAX")].join("\n")),
    T("%u, %x and %X", [P('ft_printf("%u %x %X", -1, 255, 255)', "%u %x %X", "-1", "255", "255"), P('ft_printf("%x", 0)', "%x", "0")].join("\n")),
    T("%p", `int\tx;\n\n${P('ft_printf("%p", &x)', "%p", "&x")}\n${P('ft_printf("%p", NULL)', "%p", "NULL")}`),
    T("all conversions in one format", P('ft_printf("%c%s%d%i%u%x%X%%", \'a\', "b", 1, 2, 3, 10, 11)', "%c%s%d%i%u%x%X%%", "'a'", '"b"', "1", "2", "3", "10", "11")),
    T("empty format returns 0", P('ft_printf("")', "")),
  ],
  gnl_strlen: [
    T("counts characters", `__expect_int(gnl_strlen("abc"), 3, "gnl_strlen(\\"abc\\")");\n__expect_int(gnl_strlen(""), 0, "gnl_strlen(\\"\\")");`),
    T("NULL counts as 0", `__expect_int(gnl_strlen(NULL), 0, "gnl_strlen(NULL)");`),
  ],
  gnl_strchr: [
    T("finds the newline", `char\t*s = "ab\\ncd";\n\n__expect_ptr(gnl_strchr(s, '\\n'), s + 2, "gnl_strchr(s, '\\\\n')");`),
    T("returns NULL when missing or NULL", `__expect_ptr(gnl_strchr("abc", '\\n'), 0, "gnl_strchr(\\"abc\\", '\\\\n')");\n__expect_ptr(gnl_strchr(NULL, '\\n'), 0, "gnl_strchr(NULL, '\\\\n')");`),
  ],
  gnl_strjoin: [
    T("joins onto an empty stash", `char\t*r;\n\nr = gnl_strjoin(NULL, "ab");\n__expect_str(r, "ab", "gnl_strjoin(NULL, \\"ab\\")");\nfree(r);`),
    T("joins and frees the old stash", `char\t*r;\n\nr = gnl_strjoin(strdup("ab"), "cd");\n__expect_str(r, "abcd", "gnl_strjoin(\\"ab\\", \\"cd\\")");\nfree(r);`),
    T("returns NULL and frees the stash when malloc fails", `__fail_malloc_after(1);\n__expect_ptr(gnl_strjoin(strdup("ab"), "cd"), 0, "gnl_strjoin with malloc failing");\n__expect_fail_hit("gnl_strjoin");`),
  ],
  gnl_get_line: [
    T("takes the line with its newline", `char\t*l;\n\nl = gnl_get_line("ab\\ncd");\n__expect_str(l, "ab\\n", "gnl_get_line(\\"ab\\\\ncd\\")");\nfree(l);`),
    T("last line without a newline", `char\t*l;\n\nl = gnl_get_line("abc");\n__expect_str(l, "abc", "gnl_get_line(\\"abc\\")");\nfree(l);`),
    T("a lone newline is a line", `char\t*l;\n\nl = gnl_get_line("\\n");\n__expect_str(l, "\\n", "gnl_get_line(\\"\\\\n\\")");\nfree(l);`),
    T("nothing left gives NULL", `__expect_ptr(gnl_get_line(""), 0, "gnl_get_line(\\"\\")");\n__expect_ptr(gnl_get_line(NULL), 0, "gnl_get_line(NULL)");`),
  ],
  gnl_rest: [
    T("keeps what follows the newline", `char\t*r;\n\nr = gnl_rest(strdup("ab\\ncd"));\n__expect_str(r, "cd", "gnl_rest(\\"ab\\\\ncd\\")");\nfree(r);`),
    T("nothing after the line gives NULL", `__expect_ptr(gnl_rest(strdup("ab\\n")), 0, "gnl_rest(\\"ab\\\\n\\")");\n__expect_ptr(gnl_rest(strdup("abc")), 0, "gnl_rest(\\"abc\\")");`),
  ],
  get_next_line: [
    gnlFile("two lines", "ab\ncd\n", ["ab\n", "cd\n"], 42),
    gnlFile("last line without a newline", "one\ntwo", ["one\n", "two"], 42),
    gnlFile("empty file", "", [], 42),
    gnlFile("one byte at a time", "hello\nworld\n", ["hello\n", "world\n"], 1),
    gnlFile("line longer than the buffer", "abcdefghij\nk\n", ["abcdefghij\n", "k\n"], 3),
    gnlFile("empty lines", "\n\nx\n", ["\n", "\n", "x\n"], 2),
    gnlFile("buffer bigger than the file", "a\nb", ["a\n", "b"], 9999),
    T("reads standard input (BUFFER_SIZE=4)", `char\t*l;\n\n__set_stdin("in1\\nin2");\nl = get_next_line(0);\n__expect_str(l, "in1\\n", "line 1 of stdin");\nfree(l);\nl = get_next_line(0);\n__expect_str(l, "in2", "line 2 of stdin");\nfree(l);\n__expect_ptr(get_next_line(0), 0, "end of stdin");`, "", { defines: { BUFFER_SIZE: "4" } }),
    T("bad file descriptors give NULL (BUFFER_SIZE=42)", `__expect_ptr(get_next_line(-1), 0, "get_next_line(-1)");\n__expect_ptr(get_next_line(42), 0, "get_next_line(42), never opened");`, "", { defines: { BUFFER_SIZE: "42" } }),
    T("malloc failing gives NULL without leaks (BUFFER_SIZE=42)", `int\tfd;\n\n__mkfile("t.txt", "ab\\ncd\\n");\nfd = open("t.txt", O_RDONLY);\n__fail_malloc_after(1);\n__expect_ptr(get_next_line(fd), 0, "get_next_line with malloc failing");\n__expect_fail_hit("get_next_line");\nclose(fd);`, "", { defines: { BUFFER_SIZE: "42" } }),
    T("bonus: two files at once (BUFFER_SIZE=42)", `int\t\ta;\nint\t\tb;\nchar\t*l;\n\n__mkfile("a.txt", "a1\\na2\\n");\n__mkfile("b.txt", "b1\\nb2\\n");\na = open("a.txt", O_RDONLY);\nb = open("b.txt", O_RDONLY);\nl = get_next_line(a);\n__expect_str(l, "a1\\n", "first line of a");\nfree(l);\nl = get_next_line(b);\n__expect_str(l, "b1\\n", "first line of b");\nfree(l);\nl = get_next_line(a);\n__expect_str(l, "a2\\n", "second line of a");\nfree(l);\nl = get_next_line(b);\n__expect_str(l, "b2\\n", "second line of b");\nfree(l);\n__expect_ptr(get_next_line(a), 0, "end of a");\n__expect_ptr(get_next_line(b), 0, "end of b");\nclose(a);\nclose(b);`, "", { defines: { BUFFER_SIZE: "42" }, bonus: true }),
  ],
};

/* ---------------- exercises ---------------- */

export const EX_MORE = {
  pf_putchar: {
    goal: "Write the character c to the standard output and return how many characters you printed.",
    concepts: ["write", "return counts"],
    hints: [
      "ft_printf must return how many characters it printed. Which small function could report that, one character at a time?",
      "If every printing helper returns its own count, ft_printf only has to add them up. Printing one character is the smallest case: it always prints 1.",
    ],
    solution: String.raw`int	pf_putchar(int c)
{
	unsigned char	ch;

	//[[ write one byte and count it
	//?? Store c in a single byte, write that byte to the standard output, and report that 1 character was printed.
	ch = (unsigned char)c;
	write(1, {{&ch}}, 1);
	return ({{1}});
	//]]
}`,
  },
  pf_putstr: {
    goal: "Write a string and return its length. A NULL string prints (null), like printf.",
    concepts: ["NULL", "return counts"],
    hints: [
      "What does printf(\"%s\", NULL) print on Linux and macOS? Try to guess the length it returns.",
      "printf prints the six characters (null) for a NULL string. Handle that first, then count and write the real string.",
    ],
    solution: String.raw`int	pf_putstr(char *s)
{
	int	len;

	//[[ NULL prints (null)
	//?? If s is NULL, print the text (null) instead and return its length.
	if (!s)
		return (pf_putstr({{"(null)"}}));
	//]]
	//[[ write the string and count it
	//?? Count the characters, write them in one call, and return the count.
	len = 0;
	while (s[len])
		len++;
	write(1, s, {{len}});
	return (len);
	//]]
}`,
  },
  pf_putnbr: {
    goal: "Write an int in decimal (for %d and %i) and return how many characters you printed. INT_MIN must work.",
    concepts: ["recursion", "overflow", "return counts"],
    hints: [
      "To print 42 you need '4' before '2'. Which function call could print everything except the last digit?",
      "Calling yourself with n / 10 prints the higher digits first; adding up what each call returns gives the total. Switch to a long first, because -INT_MIN does not fit in an int.",
    ],
    solution: String.raw`int	pf_putnbr(int n)
{
	long	nb;
	int		count;

	nb = n;
	count = 0;
	//[[ sign first
	//?? If the number is negative, print '-', count it, and continue with the positive value.
	if (nb < 0)
	{
		count += pf_putchar('-');
		nb = {{-nb}};
	}
	//]]
	//[[ higher digits, then the last one
	//?? If there are several digits, print the number divided by 10 first. Then print the last digit, and return the total count.
	if (nb >= 10)
		count += pf_putnbr({{nb / 10}});
	count += pf_putchar('0' + {{nb % 10}});
	return (count);
	//]]
}`,
  },
  pf_putnbr_base: {
    goal: "Write an unsigned number in any base given as its digits (for %u, %x and %X). Return how many characters you printed.",
    concepts: ["bases", "recursion"],
    hints: [
      "What do \"0123456789\" and \"0123456789abcdef\" have in common, and what does their length tell you?",
      "The base string is both the digit table and the base itself: its length is the base. Divide and take the remainder exactly as for decimal.",
    ],
    solution: String.raw`int	pf_putnbr_base(unsigned long n, const char *base)
{
	unsigned long	len;
	int				count;

	//[[ measure the base
	//?? The number of characters in base is the base you are printing in.
	len = 0;
	while (base[len])
		len++;
	//]]
	//[[ higher digits, then the last one
	//?? Print n divided by the base first if n has more than one digit, then the digit for n modulo the base.
	count = 0;
	if (n >= len)
		count += pf_putnbr_base({{n / len}}, base);
	count += pf_putchar(base[{{n % len}}]);
	return (count);
	//]]
}`,
  },
  pf_putptr: {
    goal: "Write a pointer like %p: 0x followed by the address in lowercase hex. A NULL pointer prints (nil) on Linux, 0x0 on macOS.",
    concepts: ["addresses", "hex"],
    hints: [
      "An address is just a number. Which helper you already wrote can print a number in hex?",
      "Convert the pointer to unsigned long, print 0x, then the number in base 16. NULL is a special case: either (nil) or 0x0 is accepted here.",
    ],
    solution: String.raw`int	pf_putptr(void *p)
{
	int	count;

	//[[ NULL pointer
	//?? Print (nil) for a NULL pointer, as printf does on Linux.
	if (!p)
		return (pf_putstr("(nil)"));
	//]]
	//[[ 0x, then the address in hex
	//?? Print 0x, then the address as an unsigned long in base 16, and return both counts added.
	count = pf_putstr("0x");
	count += pf_putnbr_base({{(unsigned long)p}}, "0123456789abcdef");
	return (count);
	//]]
}`,
  },
  ft_printf: {
    goal: "Recode printf for the conversions c s p d i u x X %, returning the number of characters printed.",
    concepts: ["va_list", "variadic functions", "dispatch"],
    hints: [
      "Watch the ... row in the memory view as ft_printf runs. What does each va_arg take, and how does it know which argument is next?",
      "va_start points a va_list at the first extra argument, and each va_arg takes the next one with the type you name. Walk the format: print normal characters, and after % pick the helper that matches the conversion. Pass &ap to helpers so they share your position in the arguments.",
    ],
    solution: String.raw`static int	pf_convert(char c, va_list *ap)
{
	//[[ one branch per conversion
	//?? Look at the character after %, take the next argument with the matching type, and print it with the right helper. Return what the helper printed.
	if (c == 'c')
		return (pf_putchar(va_arg(*ap, {{int}})));
	if (c == 's')
		return (pf_putstr(va_arg(*ap, char *)));
	if (c == 'p')
		return (pf_putptr(va_arg(*ap, void *)));
	if (c == 'd' || c == 'i')
		return (pf_putnbr(va_arg(*ap, int)));
	if (c == 'u')
		return (pf_putnbr_base(va_arg(*ap, {{unsigned int}}), "0123456789"));
	if (c == 'x')
		return (pf_putnbr_base(va_arg(*ap, unsigned int), "0123456789abcdef"));
	if (c == 'X')
		return (pf_putnbr_base(va_arg(*ap, unsigned int), "0123456789ABCDEF"));
	return (pf_putchar(c));
	//]]
}

int	ft_printf(const char *format, ...)
{
	va_list	ap;
	int		count;

	//[[ start reading the extra arguments
	//?? Point ap at the first argument after format, and start the count at 0.
	va_start(ap, {{format}});
	count = 0;
	//]]
	//[[ print text, convert after each %
	//?? Walk the format. A % followed by a character is a conversion: handle it with pf_convert. Anything else is printed as it is.
	while (*format)
	{
		if (*format == '%' && format[1])
		{
			format++;
			count += pf_convert(*format, {{&ap}});
		}
		else
			count += pf_putchar(*format);
		format++;
	}
	//]]
	//[[ clean up and return the count
	//?? Every va_start needs a va_end. Then return the total.
	va_end(ap);
	return ({{count}});
	//]]
}`,
  },
  gnl_strlen: {
    goal: "Count the characters of a string. A NULL string counts as 0, which makes the other helpers simpler.",
    concepts: ["NULL", "'\\0'"],
    hints: [
      "Your libft is not allowed in get_next_line. Why might a NULL-safe strlen be handy when the stash starts out empty?",
      "Before the first read, the stash is NULL. If strlen treats NULL as an empty string, joining onto it needs no special case.",
    ],
    solution: String.raw`size_t	gnl_strlen(const char *s)
{
	size_t	n;

	//[[ NULL counts as empty
	//?? If s is NULL, the length is 0.
	if (!s)
		return ({{0}});
	//]]
	//[[ count to the terminator
	//?? Count characters until the terminator.
	n = 0;
	while (s[n])
		n++;
	return (n);
	//]]
}`,
  },
  gnl_strchr: {
    goal: "Return the address of the first c in s, or NULL. A NULL string has nothing to find.",
    concepts: ["NULL", "returning pointers"],
    hints: [
      "get_next_line keeps reading until the stash contains something. What is that something, and which function tells you?",
      "You read until the stash holds a newline. A strchr that accepts NULL lets you ask before anything was read.",
    ],
    solution: String.raw`char	*gnl_strchr(const char *s, int c)
{
	//[[ NULL has nothing to find
	//?? If s is NULL, return NULL.
	if (!s)
		return ({{NULL}});
	//]]
	//[[ walk to c or to the end
	//?? Move forward until you reach c or the end, then return the address if it is c.
	while (*s && *s != (char)c)
		s++;
	if (*s == (char)c)
		return ((char *)s);
	return (NULL);
	//]]
}`,
  },
  gnl_strjoin: {
    goal: "Return a new string made of stash followed by buf, and free the old stash. stash may be NULL.",
    concepts: ["malloc", "free", "ownership"],
    hints: [
      "After joining, who still needs the old stash? What happens to it if nobody frees it?",
      "The new string replaces the stash, so the old one must be freed here, also when malloc fails. Copy stash first (it may be NULL), then buf, then terminate.",
    ],
    solution: String.raw`char	*gnl_strjoin(char *stash, const char *buf)
{
	char	*r;
	size_t	i;
	size_t	j;

	//[[ allocate both lengths plus one
	//?? Allocate room for stash, buf and the terminator. If that fails, free the stash and return NULL.
	r = malloc(gnl_strlen(stash) + gnl_strlen(buf) + 1);
	if (!r)
	{
		free({{stash}});
		return (NULL);
	}
	//]]
	//[[ copy stash, then buf
	//?? Copy every character of stash (if there is one), then every character of buf, then terminate.
	i = 0;
	while (stash && stash[i])
	{
		r[i] = stash[i];
		i++;
	}
	j = 0;
	while (buf[j])
		r[{{i++}}] = buf[j++];
	r[i] = '\0';
	//]]
	//[[ the old stash is no longer needed
	//?? Free the old stash and return the new one.
	free(stash);
	return (r);
	//]]
}`,
  },
  gnl_get_line: {
    goal: "Return a new string with the first line of stash, newline included. NULL when the stash is empty.",
    concepts: ["malloc", "'\\n'"],
    hints: [
      "For the stash \"ab\\ncd\", which characters belong to the line you return? Is the newline one of them?",
      "The line ends just after the first newline, or at the end of the stash if there is none. Measure that, allocate, copy.",
    ],
    solution: String.raw`char	*gnl_get_line(const char *stash)
{
	char	*line;
	size_t	len;
	size_t	i;

	//[[ nothing left means no line
	//?? A NULL or empty stash has no line: return NULL.
	if (!stash || !stash[0])
		return ({{NULL}});
	//]]
	//[[ measure up to and including the first newline
	//?? Count characters until the newline or the end, and include the newline if there is one.
	len = 0;
	while (stash[len] && stash[len] != '\n')
		len++;
	if (stash[len] == {{'\n'}})
		len++;
	//]]
	//[[ copy that part
	//?? Allocate len + 1 bytes and copy the first len characters, then terminate.
	line = malloc(len + 1);
	if (!line)
		return (NULL);
	i = 0;
	while (i < len)
	{
		line[i] = stash[i];
		i++;
	}
	line[i] = '\0';
	return (line);
	//]]
}`,
  },
  gnl_rest: {
    goal: "Return a new string with what follows the first line of stash, and free the old stash. NULL when nothing is left.",
    concepts: ["malloc", "free", "ownership"],
    hints: [
      "After returning \"ab\\n\" from the stash \"ab\\ncd\", what must the stash hold for the next call?",
      "Keep only what follows the first newline, in a new block, and free the old stash. If nothing follows, free it and return NULL.",
    ],
    solution: String.raw`char	*gnl_rest(char *stash)
{
	char	*rest;
	size_t	start;
	size_t	i;

	//[[ find where the next line starts
	//?? Move past the first line, including its newline.
	start = 0;
	while (stash[start] && stash[start] != '\n')
		start++;
	if (stash[start] == '\n')
		start++;
	//]]
	//[[ copy the rest, if there is any
	//?? If characters remain after start, allocate a new block and copy them into it.
	rest = NULL;
	if (stash[start])
		rest = malloc(gnl_strlen(stash + start) + 1);
	i = 0;
	while (rest && stash[{{start + i}}])
	{
		rest[i] = stash[start + i];
		i++;
	}
	if (rest)
		rest[i] = '\0';
	//]]
	//[[ the old stash is no longer needed
	//?? Free the old stash and return the rest, which may be NULL.
	free({{stash}});
	return (rest);
	//]]
}`,
  },
  get_next_line: {
    goal: "Return the next line read from fd (newline included), or NULL at the end or on error. A static stash keeps what was read past the line.",
    concepts: ["static", "read()", "BUFFER_SIZE"],
    hints: [
      "Step through two calls and watch the static memory box. What is still there when the second call starts, and why is that needed?",
      "read() hands you BUFFER_SIZE bytes at a time, which can stop in the middle of a line or include the next one. Keep reading into a static stash until it holds a newline (or the file ends), return the first line, and keep the rest for the next call.",
    ],
    solution: String.raw`#ifndef BUFFER_SIZE
# define BUFFER_SIZE 42
#endif

static char	*gnl_read(int fd, char *stash)
{
	char	*buf;
	ssize_t	n;

	//[[ a buffer for read()
	//?? Allocate BUFFER_SIZE + 1 bytes so a terminator fits after the bytes read() returns. If that fails, free the stash and stop.
	buf = malloc((size_t)BUFFER_SIZE + 1);
	if (!buf)
	{
		free(stash);
		return (NULL);
	}
	//]]
	//[[ read until the stash holds a newline or the file ends
	//?? While the stash has no newline and read() still returns bytes, terminate what was read and add it to the stash.
	n = 1;
	while (n > 0 && !gnl_strchr(stash, '\n'))
	{
		n = read(fd, buf, {{BUFFER_SIZE}});
		if (n > 0)
		{
			buf[n] = '\0';
			stash = gnl_strjoin(stash, buf);
		}
	}
	//]]
	//[[ a read error throws everything away
	//?? Free the buffer. If read() failed, free the stash too and return NULL.
	free(buf);
	if (n >= 0)
		return (stash);
	free(stash);
	return (NULL);
	//]]
}

char	*get_next_line(int fd)
{
	static char	*stash;
	char		*line;

	//[[ reject impossible requests
	//?? A negative fd or a BUFFER_SIZE of 0 or less can never give a line.
	if (fd < 0 || BUFFER_SIZE <= 0)
		return (NULL);
	//]]
	//[[ fill the stash until it holds a line
	//?? Read into the stash. If nothing is left, there is no line.
	stash = gnl_read(fd, {{stash}});
	if (!stash)
		return (NULL);
	//]]
	//[[ cut the line off the stash
	//?? Take the first line out of the stash and keep the rest for the next call.
	line = gnl_get_line(stash);
	stash = {{gnl_rest(stash)}};
	return (line);
	//]]
}`,
    // checks the bonus tests are right: one static array of stashes, one per fd
    bonusSolution: String.raw`#ifndef BUFFER_SIZE
# define BUFFER_SIZE 42
#endif

static char	*gnl_read(int fd, char *stash)
{
	char	*buf;
	ssize_t	n;

	buf = malloc((size_t)BUFFER_SIZE + 1);
	if (!buf)
	{
		free(stash);
		return (NULL);
	}
	n = 1;
	while (n > 0 && !gnl_strchr(stash, '\n'))
	{
		n = read(fd, buf, BUFFER_SIZE);
		if (n > 0)
		{
			buf[n] = '\0';
			stash = gnl_strjoin(stash, buf);
		}
	}
	free(buf);
	if (n >= 0)
		return (stash);
	free(stash);
	return (NULL);
}

char	*get_next_line(int fd)
{
	static char	*stash[1024];
	char		*line;

	if (fd < 0 || fd >= 1024 || BUFFER_SIZE <= 0)
		return (NULL);
	stash[fd] = gnl_read(fd, stash[fd]);
	if (!stash[fd])
		return (NULL);
	line = gnl_get_line(stash[fd]);
	stash[fd] = gnl_rest(stash[fd]);
	return (line);
}`,
  },
};
