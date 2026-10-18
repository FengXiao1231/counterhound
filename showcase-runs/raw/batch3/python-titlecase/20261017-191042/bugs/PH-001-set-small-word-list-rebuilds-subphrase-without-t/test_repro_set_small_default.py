from titlecase import titlecase, set_small_word_list


def test_repro_set_small_default():
    text = "foo - the end"
    before = titlecase(text)
    try:
        set_small_word_list()  # default arg == built-in SMALL list
        after = titlecase(text)
    finally:
        set_small_word_list()
    assert before == after
