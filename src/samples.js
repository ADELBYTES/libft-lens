// Example programs. Two of them contain the classic bugs on purpose, so the
// visualiser has something to catch on first load.

export const SAMPLES = [
  {
    id: "memmove", label: "ft_memmove (overlap bug)",
    code: String.raw`#include "libft.h"
#include <stdio.h>

void	*ft_memmove(void *dst, const void *src, size_t len)
{
	size_t	i;

	i = 0;
	while (i < len)
	{
		((unsigned char *)dst)[i] = ((unsigned char *)src)[i];
		i++;
	}
	return (dst);
}

int	main(void)
{
	char	buf[8] = "abcdef";

	ft_memmove(buf + 2, buf, 4);
	printf("%s\n", buf);
	return (0);
}
`,
  },
  {
    id: "strlen", label: "ft_strlen",
    code: String.raw`#include "libft.h"
#include <stdio.h>

size_t	ft_strlen(const char *s)
{
	size_t	i;

	i = 0;
	while (s[i] != '\0')
		i++;
	return (i);
}

int	main(void)
{
	const char	*str = "hi!";
	size_t		len;

	len = ft_strlen(str);
	printf("%zu\n", len);
	return (0);
}
`,
  },
  {
    id: "strdup", label: "ft_strdup (missing byte)",
    code: String.raw`#include "libft.h"
#include <stdlib.h>

size_t	ft_strlen(const char *s)
{
	size_t	i;

	i = 0;
	while (s[i])
		i++;
	return (i);
}

char	*ft_strdup(const char *s)
{
	char	*dup;
	size_t	i;

	dup = malloc(ft_strlen(s));
	if (!dup)
		return (NULL);
	i = 0;
	while (s[i])
	{
		dup[i] = s[i];
		i++;
	}
	dup[i] = '\0';
	return (dup);
}

int	main(void)
{
	char	*copy;

	copy = ft_strdup("42!");
	free(copy);
	return (0);
}
`,
  },
  {
    id: "split", label: "ft_split",
    code: String.raw`#include "libft.h"
#include <stdlib.h>
#include <stdio.h>

static size_t	count_words(char const *s, char c)
{
	size_t	n;

	n = 0;
	while (*s)
	{
		if (*s != c && (s[1] == c || s[1] == '\0'))
			n++;
		s++;
	}
	return (n);
}

static char	*dup_word(char const *s, size_t len)
{
	char	*w;
	size_t	i;

	w = malloc(len + 1);
	if (!w)
		return (NULL);
	i = 0;
	while (i < len)
	{
		w[i] = s[i];
		i++;
	}
	w[i] = '\0';
	return (w);
}

char	**ft_split(char const *s, char c)
{
	char	**words;
	size_t	k;
	size_t	len;

	words = malloc(sizeof(char *) * (count_words(s, c) + 1));
	if (!words)
		return (NULL);
	k = 0;
	while (*s)
	{
		len = 0;
		while (s[len] && s[len] != c)
			len++;
		if (len)
			words[k++] = dup_word(s, len);
		s += len + (s[len] != '\0');
	}
	words[k] = NULL;
	return (words);
}

int	main(void)
{
	char	**w;
	size_t	i;

	w = ft_split("  ab cd e", ' ');
	i = 0;
	while (w[i])
	{
		printf("[%s]\n", w[i]);
		free(w[i]);
		i++;
	}
	free(w);
	return (0);
}
`,
  },
  {
    id: "lists", label: "Linked list (bonus)",
    code: String.raw`#include "libft.h"
#include <stdlib.h>
#include <stdio.h>

t_list	*ft_lstnew(void *content)
{
	t_list	*node;

	node = malloc(sizeof(t_list));
	if (!node)
		return (NULL);
	node->content = content;
	node->next = NULL;
	return (node);
}

void	ft_lstadd_back(t_list **lst, t_list *new)
{
	t_list	*cur;

	if (!*lst)
	{
		*lst = new;
		return ;
	}
	cur = *lst;
	while (cur->next)
		cur = cur->next;
	cur->next = new;
}

int	main(void)
{
	t_list	*head;
	t_list	*next;

	head = NULL;
	ft_lstadd_back(&head, ft_lstnew("one"));
	ft_lstadd_back(&head, ft_lstnew("two"));
	ft_lstadd_back(&head, ft_lstnew("three"));
	while (head)
	{
		printf("%s\n", (char *)head->content);
		next = head->next;
		free(head);
		head = next;
	}
	return (0);
}
`,
  },
  {
    id: "blank", label: "Blank file",
    code: String.raw`#include "libft.h"
#include <stdio.h>

int	main(void)
{
	return (0);
}
`,
  },
];
