// One exercise per libft function (subject v19.3), ordered from easy to hard.
//
// Each `solution` is a Norm-style reference implementation with hidden blocks:
//   //[[ purpose        starts a block (what this step achieves)
//   //?? pseudo-step    plain-language description of the step, no C
//   ...code...          the block's code; {{x}} marks a blank for reveal step 3
//   //]]                ends the block
// Blocks must hold complete statements, so the starter still compiles after
// any subset of them is filled in. See blocks.js for how they are expanded.

export const PARTS = { 1: "Part 1 · libc", 2: "Part 2 · additional", 3: "Bonus · lists" };

export const ORDER = [
  "ft_isalpha", "ft_isdigit", "ft_isalnum", "ft_isascii", "ft_isprint", "ft_toupper", "ft_tolower",
  "ft_strlen", "ft_memset", "ft_bzero", "ft_memcpy", "ft_memmove", "ft_memchr", "ft_memcmp",
  "ft_strchr", "ft_strrchr", "ft_strncmp", "ft_strlcpy", "ft_strlcat", "ft_strnstr", "ft_atoi",
  "ft_calloc", "ft_strdup",
  "ft_putchar_fd", "ft_putstr_fd", "ft_putendl_fd", "ft_putnbr_fd", "ft_substr", "ft_strjoin",
  "ft_strtrim", "ft_strmapi", "ft_striteri", "ft_itoa", "ft_split",
  "ft_lstnew", "ft_lstadd_front", "ft_lstsize", "ft_lstlast", "ft_lstadd_back", "ft_lstdelone",
  "ft_lstclear", "ft_lstiter", "ft_lstmap",
];

export const EX = {
  ft_isalpha: {
    goal: "Return 1 if c is a letter (a to z or A to Z), otherwise 0.",
    concepts: ["chars are numbers", "ranges"],
    hints: [
      "Look at an ASCII table. Where do the lowercase letters start and end? And the uppercase ones?",
      "Characters are just numbers. 'a' to 'z' are consecutive, and so are 'A' to 'Z'. The characters between 'Z' and 'a' are not letters.",
    ],
    solution: String.raw`int	ft_isalpha(int c)
{
	//[[ test both letter ranges
	//?? If c is between 'a' and 'z', or between 'A' and 'Z', the answer is 1. Otherwise it is 0.
	if ((c >= {{'a'}} && c <= 'z') || (c >= 'A' && c <= {{'Z'}}))
		return (1);
	return (0);
	//]]
}`,
  },
  ft_isdigit: {
    goal: "Return 1 if c is a decimal digit character ('0' to '9'), otherwise 0.",
    concepts: ["chars are numbers"],
    hints: [
      "Is the character '7' the same as the number 7? Check both in an ASCII table.",
      "Digit characters are consecutive codes starting at '0'. Compare c with the characters, not with 0 and 9.",
    ],
    solution: String.raw`int	ft_isdigit(int c)
{
	//[[ test the digit range
	//?? If c is between the characters '0' and '9', return 1. Otherwise return 0.
	if (c >= {{'0'}} && c <= {{'9'}})
		return (1);
	return (0);
	//]]
}`,
  },
  ft_isalnum: {
    goal: "Return 1 if c is a letter or a digit, otherwise 0.",
    concepts: ["reuse your functions"],
    hints: [
      "You already wrote two functions that answer half of this question each. Which ones?",
      "Reusing your own libft functions is allowed and encouraged. The memory pane shows each call as its own frame.",
    ],
    solution: String.raw`int	ft_isalnum(int c)
{
	//[[ combine the two tests
	//?? Return 1 when c is a letter or a digit, using the functions you already wrote.
	if ({{ft_isalpha(c)}} || {{ft_isdigit(c)}})
		return (1);
	return (0);
	//]]
}`,
  },
  ft_isascii: {
    goal: "Return 1 if c fits in the 7-bit ASCII table (0 to 127), otherwise 0.",
    concepts: ["ranges", "negative values"],
    hints: [
      "What are the smallest and the largest ASCII codes? What should happen for -1 or 128?",
      "ASCII covers exactly the codes 0 to 127. Anything outside, negative values included, is not ASCII.",
    ],
    solution: String.raw`int	ft_isascii(int c)
{
	//[[ test the ASCII range
	//?? Return 1 when c is between 0 and 127 included. Otherwise return 0.
	if (c >= {{0}} && c <= {{127}})
		return (1);
	return (0);
	//]]
}`,
  },
  ft_isprint: {
    goal: "Return 1 if c is a printable character, space included (32 to 126), otherwise 0.",
    concepts: ["ranges"],
    hints: [
      "Which is the first character that shows something on screen, and which is the last one before DEL?",
      "Printable characters start at the space (32) and end at '~' (126). Control characters and DEL (127) are not printable.",
    ],
    solution: String.raw`int	ft_isprint(int c)
{
	//[[ test the printable range
	//?? Return 1 when c is between the space and '~'. Otherwise return 0.
	if (c >= {{32}} && c <= {{126}})
		return (1);
	return (0);
	//]]
}`,
  },
  ft_toupper: {
    goal: "If c is a lowercase letter, return the uppercase version. Return any other value unchanged.",
    concepts: ["chars are numbers", "offsets"],
    hints: [
      "How far apart are 'a' and 'A' in the ASCII table? Is the distance the same for 'z' and 'Z'?",
      "Each lowercase letter sits exactly 32 codes after its uppercase version, so converting is a subtraction. Only letters may change.",
    ],
    solution: String.raw`int	ft_toupper(int c)
{
	//[[ shift lowercase letters only
	//?? If c is a lowercase letter, return it moved back by the distance between 'a' and 'A'. Otherwise return c.
	if (c >= 'a' && c <= 'z')
		return (c - {{32}});
	return (c);
	//]]
}`,
  },
  ft_tolower: {
    goal: "If c is an uppercase letter, return the lowercase version. Return any other value unchanged.",
    concepts: ["chars are numbers", "offsets"],
    hints: [
      "This is the mirror of ft_toupper. Which direction does the shift go now?",
      "Uppercase letters sit 32 codes before their lowercase versions. Characters like '[' must not change.",
    ],
    solution: String.raw`int	ft_tolower(int c)
{
	//[[ shift uppercase letters only
	//?? If c is an uppercase letter, return it moved forward by 32. Otherwise return c.
	if (c >= 'A' && c <= 'Z')
		return (c + {{32}});
	return (c);
	//]]
}`,
  },
  ft_strlen: {
    goal: "Count the characters of a string, not counting the terminating '\\0'.",
    concepts: ["'\\0'", "indexes"],
    hints: [
      "In the memory pane, what is stored in the last cell of every string?",
      "C strings have no stored length. The only way to know where one ends is the '\\0' byte, so you count until you reach it.",
    ],
    solution: String.raw`size_t	ft_strlen(const char *s)
{
	size_t	i;

	//[[ count until the terminator
	//?? Start a counter at 0 and move it forward while the character at that position is not '\0'.
	i = 0;
	while (s[{{i}}] != {{'\0'}})
		i++;
	//]]
	//[[ return the count
	//?? The counter now equals the number of characters before the terminator.
	return ({{i}});
	//]]
}`,
  },
  ft_memset: {
    goal: "Fill the first n bytes at s with the byte value c, then return s.",
    concepts: ["void *", "bytes"],
    hints: [
      "What happens when you try to index a void pointer? What size would each step be?",
      "void * has no element size. To touch single bytes, look at the memory through a pointer to unsigned char.",
    ],
    solution: String.raw`void	*ft_memset(void *s, int c, size_t n)
{
	unsigned char	*p;
	size_t			i;

	//[[ view the memory as bytes
	//?? Make p hold the same address as s, but as a pointer to unsigned char.
	p = {{(unsigned char *)}}s;
	//]]
	//[[ write n bytes
	//?? Starting at 0, set each of the first n bytes to c converted to unsigned char.
	i = 0;
	while (i < {{n}})
	{
		p[i] = {{(unsigned char)c}};
		i++;
	}
	//]]
	//[[ give back the start
	//?? Return the original pointer, not where you stopped.
	return ({{s}});
	//]]
}`,
  },
  ft_bzero: {
    goal: "Set the first n bytes at s to zero.",
    concepts: ["void *", "bytes"],
    hints: [
      "How is this different from ft_memset? Could one of them do the other's job?",
      "Zeroing is filling with the value 0. You can write the loop again or reuse ft_memset.",
    ],
    solution: String.raw`void	ft_bzero(void *s, size_t n)
{
	unsigned char	*p;
	size_t			i;

	//[[ zero n bytes
	//?? Look at s as bytes and set each of the first n bytes to 0.
	p = (unsigned char *)s;
	i = 0;
	while (i < n)
	{
		p[i] = {{0}};
		i++;
	}
	//]]
}`,
  },
  ft_memcpy: {
    goal: "Copy n bytes from src to dst (they do not overlap) and return dst.",
    concepts: ["void *", "bytes", "const"],
    hints: [
      "src is const. What does that promise, and what type should your byte pointer to it have?",
      "memcpy copies byte by byte from the front. It does not have to handle overlap: that is memmove's job.",
    ],
    solution: String.raw`void	*ft_memcpy(void *dst, const void *src, size_t n)
{
	unsigned char		*d;
	const unsigned char	*s;
	size_t				i;

	//[[ nothing to copy between two NULLs
	//?? If both pointers are NULL, return dst without touching memory.
	if (!dst && !src)
		return ({{NULL}});
	//]]
	//[[ view both as bytes
	//?? Make byte pointers to dst and to src. Keep the const on the source.
	d = (unsigned char *)dst;
	s = {{(const unsigned char *)}}src;
	//]]
	//[[ copy n bytes forward
	//?? Copy byte 0, then byte 1, up to byte n - 1.
	i = 0;
	while (i < n)
	{
		d[i] = {{s[i]}};
		i++;
	}
	//]]
	return (dst);
}`,
  },
  ft_memmove: {
    goal: "Copy len bytes from src to dst even when the two areas overlap, then return dst.",
    concepts: ["overlap", "copy direction"],
    hints: [
      "Run the overlap test and step to the third copy. Which byte did you read, and when was it last written?",
      "When dst starts after src in the same buffer, copying from the front overwrites source bytes before you read them. Copying from the back avoids that.",
    ],
    solution: String.raw`void	*ft_memmove(void *dst, const void *src, size_t len)
{
	unsigned char		*d;
	const unsigned char	*s;
	size_t				i;

	if (!dst && !src)
		return (NULL);
	d = (unsigned char *)dst;
	s = (const unsigned char *)src;
	//[[ copy from the back when dst is after src
	//?? If dst starts after src, copy the last byte first and walk down to the first one, then return dst.
	if ({{d > s}})
	{
		while (len-- > 0)
			d[{{len}}] = s[len];
		return (dst);
	}
	//]]
	//[[ otherwise copy from the front
	//?? In every other case a plain front-to-back copy is safe.
	i = 0;
	while (i < len)
	{
		d[i] = s[i];
		{{i++}};
	}
	//]]
	return (dst);
}`,
  },
  ft_memchr: {
    goal: "Find the first byte equal to c (as unsigned char) in the first n bytes of s. Return its address, or NULL.",
    concepts: ["bytes", "returning pointers"],
    hints: [
      "Unlike strchr, memchr does not stop at '\\0'. What tells it when to stop?",
      "Compare bytes as unsigned char on both sides. The answer is an address inside s, so you return s plus an offset.",
    ],
    solution: String.raw`void	*ft_memchr(const void *s, int c, size_t n)
{
	const unsigned char	*p;
	size_t				i;

	p = (const unsigned char *)s;
	//[[ scan n bytes
	//?? Look at each of the first n bytes. When one equals c as an unsigned char, return its address.
	i = 0;
	while (i < n)
	{
		if (p[i] == {{(unsigned char)c}})
			return ((void *)(p + {{i}}));
		i++;
	}
	//]]
	return (NULL);
}`,
  },
  ft_memcmp: {
    goal: "Compare the first n bytes of s1 and s2. Return 0 if equal, otherwise the difference of the first differing bytes.",
    concepts: ["bytes", "unsigned char"],
    hints: [
      "Does memcmp care about '\\0'? What if the buffers contain zero bytes in the middle?",
      "Compare byte by byte as unsigned char. The sign of the result comes from the first pair that differs.",
    ],
    solution: String.raw`int	ft_memcmp(const void *s1, const void *s2, size_t n)
{
	const unsigned char	*a;
	const unsigned char	*b;
	size_t				i;

	a = (const unsigned char *)s1;
	b = (const unsigned char *)s2;
	//[[ find the first difference
	//?? Walk the n bytes. At the first pair that differs, return the first byte minus the second.
	i = 0;
	while (i < n)
	{
		if (a[i] != b[i])
			return ({{a[i] - b[i]}});
		i++;
	}
	//]]
	return (0);
}`,
  },
  ft_strchr: {
    goal: "Return a pointer to the first c in s, or NULL. Searching for '\\0' finds the terminator.",
    concepts: ["'\\0'", "returning pointers", "const"],
    hints: [
      "What should ft_strchr(\"abc\", '\\0') return? Where is that byte?",
      "The terminator is part of the string for strchr. Stop at the first match or at the end, then decide.",
    ],
    solution: String.raw`char	*ft_strchr(const char *s, int c)
{
	//[[ walk to a match or to the end
	//?? Move s forward while it does not point at the end and not at c (as a char).
	while (*s && *s != {{(char)c}})
		s++;
	//]]
	//[[ decide what you found
	//?? If s now points at c (this includes c being '\0'), return it. Otherwise return NULL.
	if (*s == (char)c)
		return ({{(char *)s}});
	return (NULL);
	//]]
}`,
  },
  ft_strrchr: {
    goal: "Return a pointer to the last c in s, or NULL. Searching for '\\0' finds the terminator.",
    concepts: ["'\\0'", "returning pointers"],
    hints: [
      "If you walk the whole string once, how can you remember the latest match you saw?",
      "Keep a pointer to the last match and update it each time you see c. The terminator is a special case.",
    ],
    solution: String.raw`char	*ft_strrchr(const char *s, int c)
{
	const char	*last;

	last = NULL;
	//[[ remember the latest match
	//?? Walk the whole string. Each time the character equals c, remember its address.
	while (*s)
	{
		if (*s == (char)c)
			last = {{s}};
		s++;
	}
	//]]
	//[[ the terminator counts too
	//?? If c is '\0', the answer is where you stopped. Otherwise return the last match, which may be NULL.
	if ((char)c == '\0')
		return ((char *){{s}});
	return ((char *)last);
	//]]
}`,
  },
  ft_strncmp: {
    goal: "Compare at most n characters of s1 and s2. Return 0, a negative or a positive value, like strncmp.",
    concepts: ["unsigned char", "stopping conditions"],
    hints: [
      "There are three reasons to stop comparing. What are they?",
      "Stop after n characters, at a difference, or at the end of a string. Compare the differing bytes as unsigned char.",
    ],
    solution: String.raw`int	ft_strncmp(const char *s1, const char *s2, size_t n)
{
	size_t	i;

	//[[ skip the equal prefix
	//?? Move forward while you are under n, s1 has not ended, and both characters are equal.
	i = 0;
	while (i < n && s1[i] && s1[i] == {{s2[i]}})
		i++;
	//]]
	//[[ compare where you stopped
	//?? If you used up all n characters, the strings are equal. Otherwise subtract the two bytes as unsigned char.
	if (i == n)
		return (0);
	return ((unsigned char)s1[i] - {{(unsigned char)s2[i]}});
	//]]
}`,
  },
  ft_strlcpy: {
    goal: "Copy src into dst using at most size bytes, always '\\0'-terminated when size > 0. Return the length of src.",
    concepts: ["buffer size", "'\\0'", "truncation"],
    hints: [
      "With size = 4, how many real characters fit, given that one byte must hold '\\0'?",
      "strlcpy copies up to size - 1 characters and always terminates. It returns the length it tried to create, which is strlen(src).",
    ],
    solution: String.raw`size_t	ft_strlcpy(char *dst, const char *src, size_t size)
{
	size_t	i;

	//[[ copy while there is room
	//?? If size is not 0, copy characters until src ends or only one byte of room is left, then write the terminator.
	if (size > 0)
	{
		i = 0;
		while (src[i] && i < {{size - 1}})
		{
			dst[i] = src[i];
			i++;
		}
		dst[i] = {{'\0'}};
	}
	//]]
	//[[ return the full length of src
	//?? The return value is the length of src, even when the copy was cut short.
	return ({{ft_strlen(src)}});
	//]]
}`,
  },
  ft_strlcat: {
    goal: "Append src to dst using at most size bytes in total. Return the length of the string it tried to create.",
    concepts: ["buffer size", "truncation"],
    hints: [
      "What should happen when size is not even big enough to hold dst as it is now?",
      "The return value is the initial length of dst plus the length of src, unless size is too small, then it is size plus the length of src.",
    ],
    solution: String.raw`size_t	ft_strlcat(char *dst, const char *src, size_t size)
{
	size_t	dlen;
	size_t	slen;
	size_t	i;

	dlen = ft_strlen(dst);
	slen = ft_strlen(src);
	//[[ no room at all
	//?? If size is not larger than the length of dst, nothing can be appended. Return size plus the length of src.
	if (size <= dlen)
		return ({{size + slen}});
	//]]
	//[[ append while there is room
	//?? Copy characters of src after dst while the total stays under size - 1, then terminate.
	i = 0;
	while (src[i] && dlen + i < {{size - 1}})
	{
		dst[dlen + i] = src[i];
		i++;
	}
	dst[dlen + i] = '\0';
	//]]
	return (dlen + slen);
}`,
  },
  ft_strnstr: {
    goal: "Find the first little inside big, looking at no more than len characters. Return its start, or NULL.",
    concepts: ["nested loops", "bounds"],
    hints: [
      "If little is empty, what should you return? And which characters of big are you allowed to look at?",
      "Try each start position in big. From there, match little character by character, without going past len.",
    ],
    solution: String.raw`char	*ft_strnstr(const char *big, const char *little, size_t len)
{
	size_t	i;
	size_t	j;

	//[[ an empty needle matches at once
	//?? If little is empty, return big.
	if (!*little)
		return ({{(char *)big}});
	//]]
	//[[ try every start position
	//?? For each position i inside big and under len, count how many characters of little match there. A full match means you found it.
	i = 0;
	while (big[i] && i < len)
	{
		j = 0;
		while (little[j] && big[i + j] == little[j] && {{i + j < len}})
			j++;
		if (!little[j])
			return ((char *)big + {{i}});
		i++;
	}
	//]]
	return (NULL);
}`,
  },
  ft_atoi: {
    goal: "Convert the start of a string to an int: skip whitespace, read one optional sign, then digits.",
    concepts: ["parsing", "overflow"],
    hints: [
      "Which characters count as whitespace for atoi? What happens with \"--5\" or \"+-5\"?",
      "Build the number by multiplying by 10 and adding each digit. Use a wider type, so INT_MIN does not overflow on the way.",
    ],
    solution: String.raw`int	ft_atoi(const char *nptr)
{
	long	sign;
	long	result;

	sign = 1;
	result = 0;
	//[[ skip whitespace
	//?? Move forward over spaces and the characters from '\t' to '\r'.
	while (*nptr == ' ' || (*nptr >= {{'\t'}} && *nptr <= {{'\r'}}))
		nptr++;
	//]]
	//[[ read one optional sign
	//?? If the character is '-' or '+', remember the sign and move past it. Only one sign is allowed.
	if (*nptr == '-' || *nptr == '+')
	{
		if (*nptr == '-')
			sign = {{-1}};
		nptr++;
	}
	//]]
	//[[ build the number digit by digit
	//?? While the character is a digit, multiply the result by 10 and add that digit.
	while (*nptr >= '0' && *nptr <= '9')
	{
		result = result * 10 + {{(*nptr - '0')}};
		nptr++;
	}
	//]]
	return ((int)(result * sign));
}`,
  },
  ft_calloc: {
    goal: "Allocate nmemb * size bytes set to zero. If either is 0, return a unique pointer that free() accepts.",
    concepts: ["malloc", "overflow"],
    hints: [
      "What happens to nmemb * size when both are huge? What should calloc do then?",
      "Check for multiplication overflow before allocating. Then allocate and zero every byte, for example with your ft_bzero.",
    ],
    solution: String.raw`void	*ft_calloc(size_t nmemb, size_t size)
{
	void	*p;

	//[[ refuse sizes that overflow
	//?? If size is not 0 and nmemb is larger than SIZE_MAX divided by size, the product would overflow: return NULL.
	if (size != 0 && nmemb > {{SIZE_MAX / size}})
		return (NULL);
	//]]
	//[[ allocate and zero
	//?? Ask malloc for nmemb * size bytes, check the result, then set every byte to 0.
	p = malloc(nmemb * size);
	if (!p)
		return (NULL);
	{{ft_bzero}}(p, nmemb * size);
	//]]
	return (p);
}`,
  },
  ft_strdup: {
    goal: "Return a new malloc'd copy of s, or NULL if the allocation fails.",
    concepts: ["malloc", "'\\0'"],
    hints: [
      "Count the cells of a string literal in the memory pane. How many bytes does \"42!\" really occupy?",
      "strlen counts the characters before the terminator. The copy needs one extra byte to hold '\\0', and malloc gives exactly what you ask for.",
    ],
    solution: String.raw`char	*ft_strdup(const char *s)
{
	char	*dup;
	size_t	len;
	size_t	i;

	//[[ allocate room for the copy
	//?? Ask malloc for the length of s plus one byte for the terminator, and check the result.
	len = ft_strlen(s);
	dup = malloc({{len + 1}});
	if (!dup)
		return (NULL);
	//]]
	//[[ copy, then terminate
	//?? Copy each character of s, then write '\0' after the last one.
	i = 0;
	while (i < len)
	{
		dup[i] = s[i];
		i++;
	}
	dup[{{i}}] = '\0';
	//]]
	return (dup);
}`,
  },
  ft_putchar_fd: {
    goal: "Write the character c to the file descriptor fd.",
    concepts: ["write", "addresses"],
    hints: [
      "write() wants an address and a byte count. Where is c stored, and how do you get its address?",
      "A parameter is a variable on the stack, so &c is a valid address of one byte.",
    ],
    solution: String.raw`void	ft_putchar_fd(char c, int fd)
{
	//[[ write one byte
	//?? Ask write to send 1 byte, taken from the address of c, to fd.
	write(fd, {{&c}}, {{1}});
	//]]
}`,
  },
  ft_putstr_fd: {
    goal: "Write the string s to the file descriptor fd.",
    concepts: ["write", "NULL checks"],
    hints: [
      "Do you need a loop, or can a single write do it? What do you need to know first?",
      "write can send many bytes at once if you know how many. Guard against a NULL s.",
    ],
    solution: String.raw`void	ft_putstr_fd(char *s, int fd)
{
	//[[ nothing to print
	//?? If s is NULL, stop.
	if (!s)
		return ;
	//]]
	//[[ write the whole string
	//?? Send all the characters of s with one write call.
	write(fd, s, {{ft_strlen(s)}});
	//]]
}`,
  },
  ft_putendl_fd: {
    goal: "Write the string s to fd, followed by a newline.",
    concepts: ["reuse your functions"],
    hints: [
      "Which two of your functions together do exactly this?",
      "Printing the string and printing one newline character are both solved already.",
    ],
    solution: String.raw`void	ft_putendl_fd(char *s, int fd)
{
	//[[ string, then newline
	//?? Print s with ft_putstr_fd, then print '\n' with ft_putchar_fd.
	ft_putstr_fd(s, fd);
	ft_putchar_fd({{'\n'}}, fd);
	//]]
}`,
  },
  ft_putnbr_fd: {
    goal: "Write the integer n in decimal to fd. INT_MIN must work.",
    concepts: ["recursion", "overflow"],
    hints: [
      "To print 42 you must print '4' before '2'. How can a function print the higher digits first?",
      "Calling yourself with n / 10 prints everything but the last digit. -INT_MIN does not fit in an int, so switch to a long first.",
    ],
    solution: String.raw`void	ft_putnbr_fd(int n, int fd)
{
	long	nb;

	nb = n;
	//[[ print the sign
	//?? If the number is negative, print '-' and continue with its positive value.
	if (nb < 0)
	{
		ft_putchar_fd('-', fd);
		nb = {{-nb}};
	}
	//]]
	//[[ print the higher digits first
	//?? If there is more than one digit, print the number divided by 10 first.
	if (nb >= 10)
		ft_putnbr_fd({{nb / 10}}, fd);
	//]]
	//[[ print the last digit
	//?? Print the last digit as a character.
	ft_putchar_fd('0' + {{nb % 10}}, fd);
	//]]
}`,
  },
  ft_substr: {
    goal: "Return a new string with at most len characters of s, starting at index start.",
    concepts: ["malloc", "bounds"],
    hints: [
      "What should ft_substr(\"hi\", 5, 3) return? And ft_substr(\"hello\", 3, 100)?",
      "Clamp first: a start past the end gives an empty string, and len cannot go past what is left. Then allocate exactly len + 1 bytes.",
    ],
    solution: String.raw`char	*ft_substr(char const *s, unsigned int start, size_t len)
{
	char	*sub;
	size_t	slen;
	size_t	i;

	//[[ clamp start and len
	//?? If start is at or past the end, the result is empty. Otherwise len cannot exceed what is left after start.
	slen = ft_strlen(s);
	if (start >= slen)
		len = 0;
	else if (len > {{slen - start}})
		len = slen - start;
	//]]
	//[[ allocate len + 1 bytes
	//?? Ask malloc for len characters plus the terminator, and check the result.
	sub = malloc({{len + 1}});
	if (!sub)
		return (NULL);
	//]]
	//[[ copy and terminate
	//?? Copy len characters starting at s[start], then write '\0'.
	i = 0;
	while (i < len)
	{
		sub[i] = s[{{start + i}}];
		i++;
	}
	sub[i] = '\0';
	//]]
	return (sub);
}`,
  },
  ft_strjoin: {
    goal: "Return a new string made of s1 followed by s2.",
    concepts: ["malloc", "reuse your functions"],
    hints: [
      "How many bytes does the result need in total?",
      "Measure both strings, allocate both lengths plus one, copy s1, copy s2 right after it, then terminate.",
    ],
    solution: String.raw`char	*ft_strjoin(char const *s1, char const *s2)
{
	char	*r;
	size_t	l1;
	size_t	l2;

	//[[ allocate for both strings
	//?? Measure s1 and s2, then allocate their total length plus one byte.
	l1 = ft_strlen(s1);
	l2 = ft_strlen(s2);
	r = malloc({{l1 + l2 + 1}});
	if (!r)
		return (NULL);
	//]]
	//[[ copy both, then terminate
	//?? Copy s1 at the start, s2 right after it, and put '\0' at the very end.
	ft_memcpy(r, s1, l1);
	ft_memcpy({{r + l1}}, s2, l2);
	r[l1 + l2] = '\0';
	//]]
	return (r);
}`,
  },
  ft_strtrim: {
    goal: "Return a copy of s1 without the characters of set at its start and its end.",
    concepts: ["two ends", "reuse your functions"],
    hints: [
      "Which characters are removed from \"xxhixx\" with set \"x\"? Do any in the middle get removed?",
      "Find the first character that is not in set, and the last one. ft_strchr tells you whether a character is in set, and ft_substr copies the middle.",
    ],
    solution: String.raw`char	*ft_strtrim(char const *s1, char const *set)
{
	size_t	start;
	size_t	end;

	//[[ skip set characters at the front
	//?? Move start forward while the character there is in set.
	start = 0;
	while (s1[start] && ft_strchr(set, {{s1[start]}}))
		start++;
	//]]
	//[[ skip set characters at the back
	//?? Start end at the length of s1 and move it back while the character before it is in set.
	end = ft_strlen(s1);
	while (end > start && ft_strchr(set, {{s1[end - 1]}}))
		end--;
	//]]
	//[[ copy what is left
	//?? Return the part of s1 between start and end as a new string.
	return (ft_substr(s1, start, {{end - start}}));
	//]]
}`,
  },
  ft_strmapi: {
    goal: "Return a new string where each character is f(index, character) of s.",
    concepts: ["function pointers", "malloc"],
    hints: [
      "f is a variable that holds a function. How do you call it, and what do you give it?",
      "Calling f looks like calling any function: f(i, s[i]). Allocate the result first, the same length as s.",
    ],
    solution: String.raw`char	*ft_strmapi(char const *s, char (*f)(unsigned int, char))
{
	char			*r;
	size_t			len;
	unsigned int	i;

	//[[ allocate the result
	//?? Allocate as many bytes as s needs, terminator included.
	len = ft_strlen(s);
	r = malloc(len + 1);
	if (!r)
		return (NULL);
	//]]
	//[[ apply f to every character
	//?? For each index, store f(index, character) in the result, then terminate it.
	i = 0;
	while (i < len)
	{
		r[i] = {{f(i, s[i])}};
		i++;
	}
	r[i] = '\0';
	//]]
	return (r);
}`,
  },
  ft_striteri: {
    goal: "Call f(index, address of character) on each character of s, so f can change it in place.",
    concepts: ["function pointers", "addresses"],
    hints: [
      "f receives a char *. Whose address must it get so that changes stay in s?",
      "Pass the address of each character in s, &s[i], so f can write through it.",
    ],
    solution: String.raw`void	ft_striteri(char *s, void (*f)(unsigned int, char *))
{
	unsigned int	i;

	//[[ call f on each character's address
	//?? Walk s. For each index, call f with the index and the address of that character.
	i = 0;
	while (s[i])
	{
		f(i, {{&s[i]}});
		i++;
	}
	//]]
}`,
  },
  ft_itoa: {
    goal: "Return a new string with the decimal form of n. Negative numbers and INT_MIN must work.",
    concepts: ["malloc", "digits", "overflow"],
    hints: [
      "How many characters does -120 need, terminator included? How can you count digits without printing?",
      "Count digits by dividing by 10 until zero, plus one for a minus sign (or for 0 itself). Fill the string from the right.",
    ],
    solution: String.raw`static size_t	itoa_len(long n)
{
	size_t	len;

	//[[ count the characters
	//?? Start at 1 if n is 0 or negative (for '0' or '-'), then add one for each division by 10 until n is 0.
	len = (n <= 0);
	while (n != 0)
	{
		n /= {{10}};
		len++;
	}
	return (len);
	//]]
}

char	*ft_itoa(int n)
{
	long	nb;
	size_t	len;
	char	*str;

	nb = n;
	//[[ allocate and terminate
	//?? Allocate the number of characters plus one, then put '\0' at the end.
	len = itoa_len(nb);
	str = malloc(len + 1);
	if (!str)
		return (NULL);
	str[{{len}}] = '\0';
	//]]
	//[[ handle zero and the sign
	//?? A zero is written as '0'. A negative number gets '-' first and continues as positive.
	if (nb == 0)
		str[0] = '0';
	if (nb < 0)
	{
		str[0] = '-';
		nb = {{-nb}};
	}
	//]]
	//[[ write digits from the right
	//?? While the number is not 0, write its last digit at the end and divide it by 10.
	while (nb > 0)
	{
		str[--len] = '0' + {{nb % 10}};
		nb /= 10;
	}
	//]]
	return (str);
}`,
  },
  ft_split: {
    goal: "Split s at every c into a NULL-terminated array of new strings. Free everything if any malloc fails.",
    concepts: ["char **", "malloc", "cleanup"],
    hints: [
      "For \"  ab cd e\" and ' ', how many words are there? How do you know where each one starts?",
      "Count words first to size the outer array, then copy each word into its own block. If one allocation fails, free the words you already made and the array.",
    ],
    solution: String.raw`static size_t	split_count(char const *s, char c)
{
	size_t	n;

	//[[ count the words
	//?? Walk s. A word ends at a non-separator that is followed by a separator or by the end.
	n = 0;
	while (*s)
	{
		if (*s != c && (s[1] == c || s[1] == {{'\0'}}))
			n++;
		s++;
	}
	return (n);
	//]]
}

static char	**split_free(char **words, size_t k)
{
	//[[ undo on failure
	//?? Free the k words already made, then the array itself, and return NULL.
	while (k > 0)
		free(words[{{--k}}]);
	free(words);
	return (NULL);
	//]]
}

char	**ft_split(char const *s, char c)
{
	char	**words;
	size_t	k;
	size_t	len;

	//[[ allocate the outer array
	//?? Allocate one pointer per word plus one for the final NULL.
	words = malloc(sizeof(char *) * ({{split_count(s, c) + 1}}));
	if (!words)
		return (NULL);
	//]]
	//[[ cut out each word
	//?? Measure the run of non-separators at s. If it is a word, copy it into its own string, and clean up if that fails. Then skip past it and one separator.
	k = 0;
	while (*s)
	{
		len = 0;
		while (s[len] && s[len] != c)
			len++;
		if (len)
		{
			words[k] = ft_substr(s, 0, {{len}});
			if (!words[k++])
				return (split_free(words, k - 1));
		}
		s += len + (s[len] != '\0');
	}
	words[k] = {{NULL}};
	//]]
	return (words);
}`,
  },
  ft_lstnew: {
    goal: "Allocate a new node whose content is the given pointer and whose next is NULL.",
    concepts: ["structs", "malloc", "->"],
    hints: [
      "In the memory pane, how many bytes does one t_list take? How many does a pointer take?",
      "sizeof(t_list *) is the size of an address. You need room for the whole struct: content and next.",
    ],
    solution: String.raw`t_list	*ft_lstnew(void *content)
{
	t_list	*node;

	//[[ allocate one node
	//?? Ask malloc for the size of one t_list, not of a pointer to it, and check the result.
	node = malloc(sizeof({{t_list}}));
	if (!node)
		return (NULL);
	//]]
	//[[ fill both fields
	//?? Store content in the node, and mark it as the last node.
	node->content = {{content}};
	node->next = {{NULL}};
	//]]
	return (node);
}`,
  },
  ft_lstadd_front: {
    goal: "Put the node new at the start of the list *lst.",
    concepts: ["pointer to pointer", "linked lists"],
    hints: [
      "Why does this function get t_list ** and not t_list *? Whose variable must change?",
      "The caller's head pointer has to change, so you receive its address. Link new to the old head, then make the head point at new.",
    ],
    solution: String.raw`void	ft_lstadd_front(t_list **lst, t_list *new)
{
	//[[ guard against NULL
	//?? If lst or new is NULL, do nothing.
	if (!lst || !new)
		return ;
	//]]
	//[[ link, then move the head
	//?? Make new point to the current first node, then make the caller's head point to new.
	new->next = {{*lst}};
	*lst = {{new}};
	//]]
}`,
  },
  ft_lstsize: {
    goal: "Count the nodes in a list.",
    concepts: ["linked lists", "traversal"],
    hints: [
      "How do you move from one node to the next, and how do you know you reached the end?",
      "Follow next until it is NULL, counting each node on the way. An empty list (NULL) has size 0.",
    ],
    solution: String.raw`unsigned int	ft_lstsize(t_list *lst)
{
	unsigned int	count;

	//[[ walk and count
	//?? While there is a node, count it and move to the next one.
	count = 0;
	while (lst)
	{
		count++;
		lst = {{lst->next}};
	}
	return (count);
	//]]
}`,
  },
  ft_lstlast: {
    goal: "Return the last node of a list, or NULL for an empty list.",
    concepts: ["linked lists", "traversal"],
    hints: [
      "What is special about the last node's next field?",
      "Walk while the current node has a next node. Stop on the node whose next is NULL.",
    ],
    solution: String.raw`t_list	*ft_lstlast(t_list *lst)
{
	//[[ an empty list has no last node
	//?? If lst is NULL, return NULL.
	if (!lst)
		return (NULL);
	//]]
	//[[ walk to the end
	//?? Move to the next node while there is one, then return where you stopped.
	while ({{lst->next}})
		lst = lst->next;
	return (lst);
	//]]
}`,
  },
  ft_lstadd_back: {
    goal: "Add the node new at the end of the list *lst.",
    concepts: ["pointer to pointer", "linked lists"],
    hints: [
      "What must happen when the list is empty? Whose pointer changes then?",
      "An empty list gets new as its head. Otherwise find the last node (ft_lstlast) and link new after it.",
    ],
    solution: String.raw`void	ft_lstadd_back(t_list **lst, t_list *new)
{
	//[[ guard against NULL
	//?? If lst or new is NULL, do nothing.
	if (!lst || !new)
		return ;
	//]]
	//[[ empty list
	//?? If the list is empty, new becomes the head.
	if (!*lst)
	{
		*lst = {{new}};
		return ;
	}
	//]]
	//[[ link after the last node
	//?? Find the last node and make its next point to new.
	{{ft_lstlast(*lst)}}->next = new;
	//]]
}`,
  },
  ft_lstdelone: {
    goal: "Free one node: its content with del, then the node. Do not touch the next node.",
    concepts: ["free", "function pointers"],
    hints: [
      "Two blocks of memory belong to this node. Which ones, and who knows how to free the content?",
      "del frees the content, because only the caller knows what it is. Then free the node itself, never node->next.",
    ],
    solution: String.raw`void	ft_lstdelone(t_list *lst, void (*del)(void *))
{
	//[[ guard against NULL
	//?? If lst or del is NULL, do nothing.
	if (!lst || !del)
		return ;
	//]]
	//[[ free content, then the node
	//?? Call del on the content, then free the node.
	del({{lst->content}});
	free({{lst}});
	//]]
}`,
  },
  ft_lstclear: {
    goal: "Free every node of *lst (contents with del) and set *lst to NULL.",
    concepts: ["free", "use after free"],
    hints: [
      "After you free a node, can you still read its next field? Step through and watch the memory pane.",
      "Save the next pointer before freeing the current node. Finally the caller's head must be NULL.",
    ],
    solution: String.raw`void	ft_lstclear(t_list **lst, void (*del)(void *))
{
	t_list	*next;

	//[[ guard against NULL
	//?? If lst or del is NULL, do nothing.
	if (!lst || !del)
		return ;
	//]]
	//[[ free node by node
	//?? While there is a node: remember its next, delete it with ft_lstdelone, then continue from the remembered next.
	while (*lst)
	{
		next = {{(*lst)->next}};
		ft_lstdelone(*lst, del);
		*lst = {{next}};
	}
	//]]
}`,
  },
  ft_lstiter: {
    goal: "Call f on the content of every node.",
    concepts: ["function pointers", "traversal"],
    hints: [
      "Does f get the node or the content?",
      "Walk the list like in ft_lstsize, calling f with each node's content.",
    ],
    solution: String.raw`void	ft_lstiter(t_list *lst, void (*f)(void *))
{
	//[[ guard against NULL
	//?? If f is NULL, do nothing.
	if (!f)
		return ;
	//]]
	//[[ apply f to each content
	//?? For each node, call f on its content, then move to the next node.
	while (lst)
	{
		f({{lst->content}});
		lst = lst->next;
	}
	//]]
}`,
  },
  ft_lstmap: {
    goal: "Build a new list whose contents are f(content) of each node. On any failure free the new list and return NULL.",
    concepts: ["linked lists", "malloc", "cleanup"],
    hints: [
      "If the third ft_lstnew fails, which memory have you already allocated that must be released?",
      "Each step makes new content and a new node. If the node cannot be made, delete that content and clear the whole new list.",
    ],
    solution: String.raw`t_list	*ft_lstmap(t_list *lst, void *(*f)(void *), void (*del)(void *))
{
	t_list	*head;
	t_list	*node;
	void	*content;

	if (!lst || !f || !del)
		return (NULL);
	head = NULL;
	//[[ map node by node, cleaning up on failure
	//?? For each node: compute new content with f and wrap it in a new node. If that fails, delete the content, clear the new list and return NULL. Otherwise append the node.
	while (lst)
	{
		content = f(lst->content);
		node = ft_lstnew({{content}});
		if (!node)
		{
			del(content);
			ft_lstclear({{&head}}, del);
			return (NULL);
		}
		ft_lstadd_back(&head, node);
		lst = lst->next;
	}
	//]]
	return (head);
}`,
  },
};
